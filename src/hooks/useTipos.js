import { createCachedResource } from '@/hooks/createCachedResource'

export const useTipos = createCachedResource({ table: 'tipos', orderBy: 'orden', key: 'tipos' })
