/** */
export type ID = string | number

/**Возможные типы полей Бипиума */
export type BpFieldTypes =
  | 'group'
  | 'text'
  | 'number'
  | 'date'
  | 'radiobutton'
  | 'dropdown'
  | 'checkboxes'
  | 'stars'
  | 'progress'
  | 'contact'
  | 'user'
  | 'object'
  | 'address'
  | 'file'

/**Описание Отдела*/
export interface IBpSection {
  id?: ID
  icon?: string | null
  name: string

  priority?: number
  privilegeCode?: string
}

/**Описние каталога */
export interface IBpCatalog {
  id?: ID
  sectionId: ID
  name: string
  icon?: string
  fields: IBpCatalogField[]

  privilegeCode?: string
  fieldPrivilegeCodes?: { [key: string]: any }
}

/**Описание поля каталога */
export interface IBpCatalogField {
  id?: string
  name: string
  hint?: string | null
  type: BpFieldTypes

  config?: { [key: string]: any }
  required?: string
  history?: boolean
  filterable?: boolean
  apiOnly?: boolean
  comment?: string
  visible?: { [key: string]: any } | null
}

/**Запись */
export interface IBpRecord {
  id: string
  catalogId: string
  title: string
  values: IBpValues
}
/**Запись расширенные поля*/
export interface IBpRecordExtra {
  viewsIds: string[]
  privilegeCode: string
  fieldPrivilegeCodes: { [key: string]: any }
}

export interface IBpLinkedRecord {
  sectionId: ID
  catalogId: ID
  catalogTitle: string
  catalogIcon: string
  recordId: ID
  recordTitle: string
  recordValues: IBpValues
}

/**Значения записи */
export interface IBpValues {
  [key: string]: any
}

type BpCatalogID = string | number
type BpFieldID = string | number
export type BpFieldsType = (BpFieldID | { fieldId: BpFieldID, fields?: Record<BpCatalogID, BpFieldsType> })[]

/**Простой Запрос */
export interface IBpRecordsQuery {
  /**Нужно ли подгружать связанные поля, список берется из настроек поля каталога*/
  withFieldsAdditional?: boolean
  /**
   * Список полей которые нужно подгрузить как в искомом каталоге, так и связанном каталоге(и так далее по рекурсии)
   * Например:
   * ```
   * [
   *   1 ,
   *  '2', 
   *  {fieldId: 3, fields: 
   *     {'56': // <- Это catalogId
   *       [48, 3, 
   *         { fieldId: 23, fields: 
   *           { 43: // <- Это catalogId
   *             [{ fieldId: 4, fields: 
   *               { 56: // <- Это catalogId
   *                  [14] } 
   *             }] 
   *           } 
   *         }
   *       ]
   *     }
   *  }
   * ]
   * ```
   * */
  fields?: BpFieldsType
}

/**
 * Фильтр по полям
 * https://docs.bpium.ru/integrations/api/data/records#parametr-filters-filtr-zapisei-po-polyam
 *
 * Расширенный фильтр
 * https://docs.bpium.ru/integrations/api/data/records#filters-v-formate-json-obekta
 */
export interface IBpRecordsQueryFilter extends IBpRecordsQuery {
  viewId?: ID
  searchText?: string
  sortField?: ID
  /**
   * 1 — по возрастанию (по умолчанию),
   * -1 — по убыванию
   */
  sortType?: 1 | -1
  limit?: number
  offset?: number
  filters?: string | IBpSimpleRecordsQueryFilter[]
  [key: string]: any
}

/**
 * https://docs.bpium.ru/integrations/api/data/records#parametr-filters-filtr-zapisei-po-polyam
 *
 * Описывает простые фильтры по полям
 */
export interface IBpSimpleRecordsQueryFilter {
  fieldId: ID
  value: string | {} | any[]
}

/**Описывает Вид при общем запросе*/
export interface IBpViewAll {
  id: ID
  catalogId: ID
  name: string
  catalogTitle: string
  catalogIcon: string
  originName: string
  forRights: boolean
  privilegeCode: string
}
/**Оисывает один вид конкретного вида*/
export interface IBpView {
  id: ID
  name: string
  forRights: boolean
  filters: Record<string, any>[]
  privilegeCode: string
}

export interface IBpHistory {
  id: ID
  catalogId: ID
  recordId: ID
  recordTitle: string
  actionType: 'CREATE' | 'REMOVED' | 'UPDATE' | 'COMMENT'
  payload: Record<string, any>
  date: string
  user: { id: ID; title: string }
}

export interface IBpRelation {
  id: ID
  sectionId: ID
  icon: string
  title: string
  privilegeCode: string
  fieldId: ID
  fieldName: string
  records: Record<string, any>[]
  recordsTotal: number
}

/**Ключ доступа загружаемого файла */
export interface IFileKey {
  AWSAccessKeyId: string
  acl: string
  fileId: string
  fileKey: string
  police: string
  redirect: string
  signature: string
  uploadUrl: string
  name: string
  mimeType: string
}
