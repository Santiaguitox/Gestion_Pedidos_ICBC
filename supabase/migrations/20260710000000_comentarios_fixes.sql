-- ============================================================================
-- FIXES DE COMENTARIOS — revisión de código post-entrega
--
-- Tres arreglos sobre 20260709100000_comentarios_pedidos.sql:
--
--   1. eliminar_comentario: la comparación `auth.uid() <> v_autor` con
--      v_autor NULL (comentario cuyo autor fue eliminado — user_id es
--      `on delete set null`) da NULL, y `NULL AND true` en un IF se
--      trata como falso: la excepción NUNCA se levantaba y cualquier
--      colaborador podía soft-deletear comentarios huérfanos. Se pasa
--      a `is distinct from`, que trata NULL como un valor comparable.
--
--   2. Policy de UPDATE del autor: sin la condición `deleted_at is
--      null`, el autor podía "resucitar" (deleted_at = null) o editar
--      el texto de un comentario que un admin moderó, con un request
--      directo contra la API. El soft delete legítimo no se ve
--      afectado: va por la RPC eliminar_comentario, que es security
--      definer y no pasa por esta policy.
--
--   3. Menciones agregadas al EDITAR ahora notifican: el trigger
--      original era solo AFTER INSERT, pero el composer de edición
--      mantiene el autocomplete de '@' a propósito — la mención se
--      guardaba y renderizaba pero el mencionado jamás se enteraba.
--      Nuevo trigger AFTER UPDATE que notifica únicamente el DIFF
--      (uuids en NEW.menciones que no estaban en OLD.menciones), con
--      las mismas validaciones del trigger de insert: contra profiles
--      (descarta uuids basura), salteando viewers y al propio autor.
--      No dispara sobre comentarios eliminados (la moderación también
--      es un UPDATE — setea deleted_at — y no debe notificar nada).
-- ============================================================================


-- ============================================================================
-- 1. RPC eliminar_comentario — comparación NULL-safe
-- ============================================================================

create or replace function public.eliminar_comentario(p_comentario_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_autor uuid;
  v_existe boolean;
begin
  select user_id, true into v_autor, v_existe
    from public.pedido_comentarios where id = p_comentario_id;

  if v_existe is not true then
    raise exception 'Comentario inexistente';
  end if;

  -- `is distinct from`: si el autor fue eliminado (v_autor NULL), la
  -- condición da TRUE para cualquier no-admin — solo admin/super_admin
  -- pueden moderar comentarios huérfanos. Con `<>` la comparación daba
  -- NULL y el IF entero se caía a falso: puerta abierta.
  if auth.uid() is distinct from v_autor
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
-- 2. Policy de UPDATE — el autor solo edita comentarios VIVOS
-- ============================================================================

drop policy if exists "comentarios: autor edita los propios" on public.pedido_comentarios;
create policy "comentarios: autor edita los propios"
  on public.pedido_comentarios for update
  using (auth.uid() = user_id and deleted_at is null)
  -- El WITH CHECK repite deleted_at is null a propósito: además de no
  -- poder TOCAR un comentario eliminado (USING), el autor tampoco puede
  -- eliminarlo "a mano" seteando deleted_at por API — el único camino
  -- de borrado es la RPC, que registra el criterio de permisos en un
  -- solo lugar.
  with check (auth.uid() = user_id and deleted_at is null);


-- ============================================================================
-- 3. Menciones agregadas en una edición → notificación tipo 'mencion'
--    (mismo formato de mensaje y data que el trigger de insert, así la
--    campanita y el push las agrupan exactamente igual)
-- ============================================================================

create or replace function public.notif_comentario_editado()
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
begin
  -- La moderación (soft delete) también es un UPDATE: no notifica.
  if NEW.deleted_at is not null then
    return NEW;
  end if;

  -- Solo si la edición efectivamente sumó menciones.
  if NEW.menciones is not distinct from OLD.menciones then
    return NEW;
  end if;

  select full_name into v_autor from public.profiles where id = NEW.user_id;
  select asunto into v_asunto from public.pedidos where id = NEW.pedido_id;
  v_autor := coalesce(v_autor, 'Alguien');

  v_snippet := left(
    regexp_replace(NEW.contenido, '@\[([^\]]+)\]\([0-9a-fA-F-]+\)', '@\1', 'g'),
    120
  );

  -- Solo el DIFF: menciones nuevas que no estaban antes de editar. Los
  -- ya mencionados no se re-notifican por una corrección de tipeo.
  -- OLD.menciones nunca es NULL (default '{}'), así que `<> all` sobre
  -- array vacío da true y no hay trampa de NULL acá.
  for v_uid in
    select p.id from public.profiles p
    where p.id = any(NEW.menciones)
      and p.id <> all(OLD.menciones)
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
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_notif_comentario_editado on public.pedido_comentarios;
create trigger trg_notif_comentario_editado
  after update on public.pedido_comentarios
  for each row execute function public.notif_comentario_editado();
