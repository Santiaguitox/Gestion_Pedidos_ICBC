import { useEffect, useRef, useState } from 'react'
import { AuthContext } from '@/context/useAuth'
import { supabase } from '@/lib/supabase'

// El contexto y el hook useAuth viven en useAuth.js — ver el
// comentario allá (Fast Refresh exige que este archivo exporte SOLO
// componentes).

export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState({
    session: undefined,
    profile: null,
  })

  // onAuthStateChange puede disparar varias veces en ráfaga (SIGNED_IN,
  // TOKEN_REFRESHED, sign out + sign in rápido...) y loadProfile es
  // async: sin este contador, la llamada que RESUELVE última pisa el
  // estado aunque haya sido la que ARRANCÓ primero (carrera clásica de
  // requests fuera de orden). Cada llamada toma un número de secuencia
  // al arrancar y solo aplica su setState si sigue siendo la vigente.
  const seqRef = useRef(0)

  async function loadProfile(session) {
    const seq = ++seqRef.current

    if (!session) {
      setAuthState({ session: null, profile: null })
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, full_name, email, area_equipo')
      .eq('id', session.user.id)
      .single()

    // Si mientras esperábamos la respuesta arrancó otra carga (nuevo
    // evento de auth), este resultado ya está viejo: no tocar nada.
    if (seq !== seqRef.current) return

    setAuthState({ session, profile })
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = {
    session: authState.session,
    profile: authState.profile,
    user: authState.session?.user ?? null,
    role: authState.profile?.role ?? null,
    loading: authState.session === undefined,
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

