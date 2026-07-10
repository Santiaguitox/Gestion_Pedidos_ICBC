-- ============================================================================
-- COMENTARIOS POR PEDIDO — con @menciones y reacciones emoji
--
-- Diseño (ver conversación de diseño en la entrega):
--   - Los comentarios son la conversación INTERNA del equipo sobre un
--     pedido. El rol 'viewer' (usuario del lado del cliente) queda
--     afuera en TODAS las capas: RLS (la barrera real), realtime (que
--     respeta RLS), menciones (el trigger lo saltea) y UI (la sección
--     ni se monta). No es solo esconder el acordeón: sin la policy de
--     SELECT, un viewer con la anon key leería todo igual.
--   - El texto guarda menciones como tokens @[Nombre](uuid) y la
--     columna `menciones` (uuid[]) es el dato denormalizado que
--     consume el trigger — iterar uuids en plpgsql es trivial,
--     parsear tokens con regex ahí adentro sería frágil.
--   - Soft delete (deleted_at) con placeholder en UI, patrón Slack:
--     borrar de verdad rompería la continuidad del hilo. No existe
--     policy de DELETE a propósito.
--   - Las notificaciones REUSAN el sistema existente: dos tipos nuevos
--     ('mencion' y 'comentario') sobre la misma tabla, mismo
--     crear_notificacion, mismo grupo_key generado, y el Web Push sale
--     gratis vía trg_notif_despachar_push (que dispara en cualquier
--     INSERT de notificaciones).
--
-- Reacciones: pedido_comentario_reacciones con UNIQUE(comentario, user,
-- emoji) — el "toggle" del frontend es insert o delete de la propia
-- fila. `pedido_id` está denormalizado a propósito: es lo que permite
-- suscribir el realtime con un solo filtro `pedido_id=eq.X` (el filtro
-- de postgres_changes es de una sola columna). Las reacciones NO
-- generan notificación: son el "visto" liviano, no un evento.
-- ============================================================================


-- ============================================================================
-- 1. TIPOS NUEVOS DE NOTIFICACIÓN
--    Mismo patrón que 20260708130000 (que agregó 'descarga').
-- ============================================================================

alter table public.notificaciones
  drop constraint if exists notificaciones_tipo_check;

alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('cambio_estado', 'asignacion', 'aprobacion', 'vencimiento', 'sistema', 'descarga', 'mencion', 'comentario'));


-- ============================================================================
-- 2. TABLA pedido_comentarios
-- ============================================================================

create table if not exists public.pedido_comentarios (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos(id) on delete cascade,
  -- on delete set null (NO cascade), mismo criterio que la migración
  -- fix_eliminar_usuarios_fk: borrar un usuario no borra su parte de
  -- la conversación de pedidos viejos — se muestra "Usuario eliminado".
  user_id    uuid references public.profiles(id) on delete set null,
  contenido  text not null check (char_length(contenido) between 1 and 4000),
  menciones  uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);

-- La consulta caliente: todos los comentarios de un pedido en orden.
create index if not exists idx_pedido_comentarios_pedido
  on public.pedido_comentarios (pedido_id, created_at);


-- ============================================================================
-- 3. TABLA pedido_comentario_reacciones
-- ============================================================================

create table if not exists public.pedido_comentario_reacciones (
  id            uuid primary key default gen_random_uuid(),
  comentario_id uuid not null references public.pedido_comentarios(id) on delete cascade,
  -- Denormalizado: habilita el filtro de realtime por pedido (una sola
  -- suscripción por pantalla de detalle). Siempre coincide con el
  -- pedido del comentario — lo garantiza el trigger de consistencia
  -- de la sección 5.
  pedido_id     uuid not null references public.pedidos(id) on delete cascade,
  -- Acá sí cascade: una reacción huérfana no aporta contexto (a
  -- diferencia de un comentario, que es parte del hilo).
  user_id       uuid not null references public.profiles(id) on delete cascade,
  -- Sin CHECK de lista cerrada de emojis a propósito: la lista curada
  -- vive en el frontend (src/lib/comentarios.js) y ampliarla no debe
  -- requerir migración. Solo se acota el largo (un emoji compuesto con
  -- ZWJ puede ocupar varios codepoints).
  emoji         text not null check (char_length(emoji) between 1 and 16),
  created_at    timestamptz not null default now(),
  -- El "toggle" del frontend: cada persona reacciona a lo sumo una vez
  -- con cada emoji a cada comentario.
  unique (comentario_id, user_id, emoji)
);

create index if not exists idx_reacciones_pedido
  on public.pedido_comentario_reacciones (pedido_id);


-- ============================================================================
-- 4. RLS — el viewer queda afuera de TODO (contenido interno del equipo)
-- ============================================================================

alter table public.pedido_comentarios enable row level security;
alter table public.pedido_comentario_reacciones enable row level security;

-- ── Comentarios ──

drop policy if exists "comentarios: equipo lee" on public.pedido_comentarios;
create policy "comentarios: equipo lee"
  on public.pedido_comentarios for select
  using (my_role() = any (array['super_admin', 'admin', 'colaborador']));

drop policy if exists "comentarios: equipo escribe a nombre propio" on public.pedido_comentarios;
create policy "comentarios: equipo escribe a nombre propio"
  on public.pedido_comentarios for insert
  with check (
    auth.uid() = user_id
    and my_role() = any (array['super_admin', 'admin', 'colaborador'])
  );

-- UPDATE solo del autor sobre sus filas: cubre editar contenido/menciones
-- y su propio soft delete. La moderación de admins va por RPC (sección 6)
-- para que un admin pueda ELIMINAR comentarios ajenos pero no EDITARLES
-- el texto — una policy de UPDATE no puede distinguir columnas.
drop policy if exists "comentarios: autor edita los propios" on public.pedido_comentarios;
create policy "comentarios: autor edita los propios"
  on public.pedido_comentarios for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Sin policy de DELETE: el borrado es siempre soft (deleted_at).

-- ── Reacciones ──

drop policy if exists "reacciones: equipo lee" on public.pedido_comentario_reacciones;
create policy "reacciones: equipo lee"
  on public.pedido_comentario_reacciones for select
  using (my_role() = any (array['super_admin', 'admin', 'colaborador']));

drop policy if exists "reacciones: equipo reacciona a nombre propio" on public.pedido_comentario_reacciones;
create policy "reacciones: equipo reacciona a nombre propio"
  on public.pedido_comentario_reacciones for insert
  with check (
    auth.uid() = user_id
    and my_role() = any (array['super_admin', 'admin', 'colaborador'])
  );

-- Quitar la reacción propia es el otro lado del toggle: acá el DELETE
-- real sí corresponde (no hay hilo que preservar).
drop policy if exists "reacciones: quitar las propias" on public.pedido_comentario_reacciones;
create policy "reacciones: quitar las propias"
  on public.pedido_comentario_reacciones for delete
  using (auth.uid() = user_id);


-- ============================================================================
-- 5. CONSISTENCIA: pedido_id de la reacción = pedido_id del comentario
--    (el denormalizado nunca puede divergir, ni por bug ni por request
--    armado a mano contra la API)
-- ============================================================================

create or replace function public.reaccion_validar_pedido()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pedido uuid;
begin
  select pedido_id into v_pedido
    from public.pedido_comentarios where id = NEW.comentario_id;
  if v_pedido is null then
    raise exception 'Comentario inexistente';
  end if;
  -- Se corrige en silencio en vez de rechazar: el valor correcto es
  -- derivable, no hay ambigüedad que amerite un error al usuario.
  NEW.pedido_id := v_pedido;
  return NEW;
end;
$$;

drop trigger if exists trg_reaccion_validar_pedido on public.pedido_comentario_reacciones;
create trigger trg_reaccion_validar_pedido
  before insert on public.pedido_comentario_reacciones
  for each row execute function public.reaccion_validar_pedido();


-- ============================================================================
-- 6. MODERACIÓN: soft delete vía RPC
--    Autor o admin/super_admin. Va por función (no por policy de UPDATE
--    para admins) para que la moderación solo pueda tocar deleted_at,
--    nunca el texto de un comentario ajeno.
-- ============================================================================

create or replace function public.eliminar_comentario(p_comentario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor uuid;
begin
  select user_id into v_autor
    from public.pedido_comentarios where id = p_comentario_id;

  if v_autor is null and not exists (
    select 1 from public.pedido_comentarios where id = p_comentario_id
  ) then
    raise exception 'Comentario inexistente';
  end if;

  if auth.uid() <> v_autor
     and public.my_role() not in ('super_admin', 'admin') then
    raise exception 'Sin permiso para eliminar este comentario';
  end if;

  update public.pedido_comentarios
     set deleted_at = now()
   where id = p_comentario_id
     and deleted_at is null;
end;
$$;


-- ============================================================================
-- 7. NOTIFICACIONES: trigger AFTER INSERT sobre comentarios
--    Prioridad: primero menciones (tipo 'mencion', pesa más), después
--    asignados del pedido no mencionados (tipo 'comentario', agrupa por
--    grupo_key así una ráfaga de comentarios es UNA entrada en la
--    campanita). El Web Push sale solo: crear_notificacion inserta en
--    notificaciones y trg_notif_despachar_push hace el resto, con
--    tag = grupo_key para que el celular también colapse la ráfaga.
-- ============================================================================

create or replace function public.notif_comentario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor text;
  v_asunto text;
  v_snippet text;
  v_uid uuid;
  v_notificados uuid[];
begin
  select full_name into v_autor from public.profiles where id = NEW.user_id;
  select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
  v_autor := coalesce(v_autor, 'Alguien');

  -- Snippet legible: los tokens @[Nombre](uuid) se reducen a @Nombre
  -- para el texto de la notificación (y de la push).
  v_snippet := left(
    regexp_replace(NEW.contenido, '@\[([^\]]+)\]\([0-9a-fA-F-]+\)', '@\1', 'g'),
    120
  );

  -- El autor nunca se auto-notifica.
  v_notificados := array[NEW.user_id];

  -- 1) Menciones — validadas contra profiles: dedupe automático (una
  --    fila por perfil aunque el array traiga repetidos), se descartan
  --    uuids basura inyectados a mano contra la API, y se saltea a los
  --    viewers: no se menciona a quien no puede leer el contenido (le
  --    llegaría una notificación apuntando a algo invisible, y el texto
  --    ya filtraría parte del comentario).
  for v_uid in
    select p.id from public.profiles p
    where p.id = any(NEW.menciones)
      and p.role <> 'viewer'
      and p.id <> NEW.user_id
  loop
    perform public.crear_notificacion(
      v_uid,
      NEW.pedido_id,
      v_autor || ' te mencionó en "' || coalesce(v_asunto, 'un pedido') || '": ' || v_snippet,
      'mencion',
      jsonb_build_object(
        'asunto', v_asunto,
        'autor', v_autor,
        'comentario_id', NEW.id,
        'snippet', v_snippet
      )
    );
    v_notificados := v_notificados || v_uid;
  end loop;

  -- 2) Asignados del pedido no mencionados ni autor (patrón Asana:
  --    los colaboradores del ítem se enteran de la conversación sin
  --    mención explícita). Mismo recorrido de pedido_asignados que
  --    notif_cambio_estado. También saltea viewers por si alguno
  --    quedara asignado por algún flujo viejo.
  for v_uid in
    select pa.user_id
    from public.pedido_asignados pa
    join public.profiles p on p.id = pa.user_id
    where pa.pedido_id = NEW.pedido_id
      and p.role <> 'viewer'
      and pa.user_id <> all(v_notificados)
  loop
    perform public.crear_notificacion(
      v_uid,
      NEW.pedido_id,
      v_autor || ' comentó en "' || coalesce(v_asunto, 'un pedido') || '": ' || v_snippet,
      'comentario',
      jsonb_build_object(
        'asunto', v_asunto,
        'autor', v_autor,
        'comentario_id', NEW.id,
        'snippet', v_snippet
      )
    );
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notif_comentario_nuevo on public.pedido_comentarios;
create trigger trg_notif_comentario_nuevo
  after insert on public.pedido_comentarios
  for each row execute function public.notif_comentario_nuevo();


-- ============================================================================
-- 8. REALTIME
--    Si la publication supabase_realtime es FOR ALL TABLES (o las
--    tablas ya fueron agregadas por el dashboard), el ALTER falla — el
--    bloque lo absorbe: en ese caso ya están publicadas y no hay nada
--    que hacer. Verificar igual tras aplicar (ver notas de la entrega).
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.pedido_comentarios;
exception when others then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.pedido_comentario_reacciones;
exception when others then null;
end $$;
