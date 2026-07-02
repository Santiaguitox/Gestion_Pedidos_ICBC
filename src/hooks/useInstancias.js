import { createCachedResource } from '@/hooks/createCachedResource'

export const useInstancias = createCachedResource({ table: 'instancias', orderBy: 'orden', key: 'instancias' })
