import { createCachedResource } from '@/hooks/createCachedResource'

export const useEstados = createCachedResource({ table: 'estados', orderBy: 'orden', key: 'estados' })
