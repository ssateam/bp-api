import axios, { AxiosResponse, Method } from 'axios'
import qs from 'qs'
import _ from 'lodash'
import FormData from 'form-data'
import {
  IBpCatalog,
  IBpLinkedRecord,
  IBpRecord,
  IBpRecordExtra,
  IBpRecordsQuery,
  IBpRecordsQueryFilter,
  IBpSection,
  IBpView,
  ID,
  IFileKey,
  IBpViewAll,
  IBpHistory,
  IBpRelation,
} from './interfaces'
import stream from 'stream'
import { IBpValues } from './values'

/**
 * Для удобного восприятия из error убираем лишнее
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!BP.debug && error.isAxiosError && _.get(error, 'response.status', false)) {
      // console.log(error)
      const responseData = _.get(error, 'response.data', false)
      error.request = '-'
      error.response = {
        status: error.response.status,
        data: responseData,
      }
      error.message =
        `${error.message}\n method: ${error.config.method}\n url: ${error.config.url}` +
        `\n request params: ${JSON.stringify(error.config.params, null, 2)}` +
        `\n request data: ${error.config.data}` +
        (!responseData ? '' : `\n response data: ${JSON.stringify(responseData, null, 2)}`)
    }
    return Promise.reject(error)
  }
)

interface IOpt {
  /**Имя ресурса API */
  resource:
  | 'record'
  | 'catalog'
  | 'section'
  | 'view'
  | 'board'
  | 'histories'
  | 'relations'
  | 'file'
  | 'values'
  | 'login'
  | 'availableRecords'

  viewId?: ID
  boardId?: ID
  type?: any
  widgetId?: ID
  fieldId?: ID
  sectionId?: ID
  catalogId?: ID
  recordId?: ID
}

/**
 * https://docs.bpium.ru/integrations/api/
 *
 * Класс следит за состоянием  текущей сессии
 * и если нужно пролонгирует её, или получит снова
 *
 * Нужно ОБЯЗАТЕЛЬНО обрабатывать исключения при выполнениях запросов!, иначе возможен выброс до остановки приложения
 * ```
 * //например так
 * try{
 *   await bp.getRecords(...)
 * }catch(e){
 *   notify.error(e.message)
 * }
 * ```
 * Error из axios будет уменьшен для удобного восприятия.
 * Для получения полного Error нужно поставить флаг BP.debug = true
 */
class BP {
  /**Определяет режим вывода ошибок, если true, то ошибки будут выводиться как есть*/
  static debug: boolean = false

  public readonly baseUrl: string
  private sidCookie: string = ''
  /**
   * Конструктор объекта для последующей работы с api bpium
   * @param domen домен
   * @param login логин
   * @param password пароль
   * @param protocol протокол, по умолчанию https
   * @param timeout по умолчанию 30 секунд
   */
  constructor(
    public readonly domen: string,
    public readonly login: string,
    private readonly password: string,
    public readonly protocol: string = 'https',
    public readonly timeout = 30000
  ) {
    if (!domen) throw new Error(`domen can't be empty`)
    if (!login) throw new Error(`login can't be empty`)
    if (!password) throw new Error(`password can't be empty`)
    this.baseUrl = `${protocol}://${domen}/api/v1`
  }

  public _getUrl(opt: IOpt): string {
    switch (opt.resource) {
      case 'record':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/records/${opt.recordId ?? ''}`
      case 'catalog':
        return `${this.baseUrl}/catalogs/${opt.catalogId ?? ''}`
      case 'section':
        return `${this.baseUrl}/sections/${opt.sectionId ?? ''}`
      case 'view':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/views/${opt.viewId ?? ''}`
      case 'board':
        return `${this.baseUrl}/boards/${opt.boardId}/widgets/${opt.widgetId}/${opt.type}`
      case 'histories':
        return `${this.baseUrl}/histories`
      case 'relations':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/records/${opt.recordId}/relations`
      case 'file':
        return `${this.baseUrl}/files/`
      case 'values':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/values`
      case 'login':
        return `${this.protocol}://${this.domen}/auth/login`
      case 'availableRecords':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/fields/${opt.fieldId}/availableRecords`
    }
  }

  /**
   * @param {string} url к ресурсу
   * @param {string} method метод обращения к ресурсу
   * @param {Object} data параметры тела запроса
   * @param {Object} params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  private async _requestWithAuthCookie(
    url: string,
    method: Method,
    data: object = {},
    params: object = {}
  ): Promise<AxiosResponse<any>> {
    return await axios.request({
      timeout: this.timeout,
      url: url,
      method,
      params,
      paramsSerializer: function (params) {
        return qs.stringify(params)
      },
      headers: {
        Cookie: this.sidCookie,
        'Content-type': 'application/json',
      },
      data,
    })
  }
  /**
   * @param url к ресурсу
   * @param method метод обращения к ресурсу
   * @param data параметры тела запроса
   * @param params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  private async _requestWithAuthBasic(
    url: string,
    method: Method,
    data: object = {},
    params: object = {}
  ): Promise<AxiosResponse<any>> {
    const result = await axios.request({
      auth: {
        username: this.login,
        password: this.password,
      },
      timeout: this.timeout,
      url: url,
      method: method,
      params: params,
      paramsSerializer: function (params) {
        return qs.stringify(params)
      },
      headers: {
        'Content-type': 'application/json',
      },
      data: data,
    })

    const setCookies: string[] = _.get(result, 'headers["set-cookie"]', [])
    const sidCookieRaw = setCookies.find((item: string) => item.startsWith('connect.sid=')) || ''
    this.sidCookie = sidCookieRaw.replace(/(connect\.sid\=[^;]+);.*$/gm, '$1')

    return result
  }

  /**
   * https://docs.bpium.ru/integrations/api
   *
   * @param url к ресурсу
   * @param method метод обращения к ресурсу
   * @param data параметры тела запроса
   * @param params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  private async _request(url: string, method: Method, data: object = {}, params: object = {}): Promise<AxiosResponse> {
    if (!this.sidCookie) {
      return await this._requestWithAuthBasic(url, method, data, params)
    } else
      try {
        return await this._requestWithAuthCookie(url, method, data, params)
      } catch (errorCookie: any) {
        const isAuthError = _.get(errorCookie, 'response.status', 0) == 401
        if (!isAuthError) {
          throw errorCookie
        }

        return await this._requestWithAuthBasic(url, method, data, params)
      }
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records#poluchit-zapis
   *
   * @param  catalogId id каталога
   * @param  recordId  id записи
   * @param  params  набор возвращаемых полей записей, формат: ["2", "3"]
   * @returns Вернет запись из каталога catalogId и id равный recordId
   */
  public async getRecordById<ValuesType extends IBpValues>(
    catalogId: ID,
    recordId: ID,
    params: IBpRecordsQuery = {}
  ): Promise<IBpRecord<ValuesType> & IBpRecordExtra> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    let url = this._getUrl({ resource: 'record', catalogId, recordId })
    let response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/records#poluchit-zapisi
   * 
   * @param catalogId  id каталога
   * @param params описание параметров в ссылке. 
   * Если нужно использовать расширенный фильтр, то его можно подать так:
   * ```
   *  const records = await bp.getRecords(tempCatalogId, {
      filters: JSON.stringify(
        {
          "$and": [
            {2: '1'},
            {4: { "$or": [[1, 2], [2]] }}
          ]
        })
    })
   * ```
   * @returns вернет массив записей
   */
  async getRecords<ValuesType extends IBpValues>(catalogId: ID, params?: IBpRecordsQueryFilter): Promise<(IBpRecord<ValuesType>)[]> {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId: '' })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#poluchit-katalog
   *
   * @param catalogId id каталога
   * @returns если catalogId не пусто, то вернет описание полей каталога в виде объекта https://docs.bpium.ru/integrations/api/data/catalogs#poluchit-katalog
   * , если catalogId пустой, то вернет массив описаний всех каталогов
   */
  async getCatalog(): Promise<IBpCatalog[]>
  async getCatalog(catalogId: ID): Promise<IBpCatalog>
  async getCatalog(catalogId?: ID): Promise<IBpCatalog | IBpCatalog[]> {
    const url = this._getUrl({ resource: 'catalog', catalogId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/sections#poluchit-otdely
   *
   * @param sectionId id отдела
   * @returns если sectionId не пусто, вернет объект описания найденного по sectionId отдела,
   *  если sectionId пустой, то  вернет массив всех отделов.
   */
  async getSection(): Promise<IBpSection[]>
  async getSection(sectionId: ID): Promise<IBpSection>
  async getSection(sectionId?: ID): Promise<IBpSection | IBpSection[]> {
    const url = this._getUrl({ resource: 'section', sectionId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/views#poluchit-vidy
   *
   * @param catalogId id каталога
   * @param viewId id вида
   * @returns вернет массив видов для каталога если viewId пусто,
   * вернет один вид если viewId не пустой
   */
  async getView(catalogId: ID): Promise<IBpViewAll[]>
  async getView(catalogId: ID, viewId: ID): Promise<IBpView>
  async getView(catalogId: ID, viewId?: ID): Promise<IBpView | IBpViewAll[]> {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'view', viewId, catalogId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/manual/reports/widgets
   *
   * @param boardId
   * @param params параметры запроса
   * @param widgetId
   * @param type
   * @returns
   */
  async getWidget(boardId: ID, params = {}, widgetId = 'new', type = 'values') {
    if (!boardId) throw new Error(`boardId is required`)
    const url = this._getUrl({ resource: 'board', boardId, widgetId, type })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/istoriya-history#poluchit-istoriyu
   *
   * @param catalogId id каталога
   * @param recordId id записи
   * @param params параметры запроса (см. ссылку)
   * @returns вернет массив записей истории. Если recordId не указан, то вернет историю по всему каталогу
   *
   */
  async getHistory(
    catalogId: ID,
    recordId?: ID,
    params: { limit?: number; from?: number; sortType?: string; userId?: ID } = {}
  ): Promise<IBpHistory[]> {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'histories' })
    const response = await this._request(url, 'GET', undefined, { catalogId, recordId, ...params })
    return response.data
  }
  /**
   * Агрегация. Разложение данных по осям
   * https://docs.bpium.ru/integrations/api/agregate/values
   *
   * @param catalogId  id каталога
   * @param params параметры запроса
   * @returns
   */
  async getValues(catalogId: ID, params = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'values', catalogId })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * Получение связей с записью
   * https://docs.bpium.ru/integrations/api/data/relations-relations
   *
   * @param catalogId id каталога
   * @param recordId  id записи
   * @param params параметры запроса
   * @returns вернет массив связей
   */
  async getRelations(catalogId: ID, recordId: ID, params: Record<string, any> = {}): Promise<IBpRelation[]> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    const url = this._getUrl({ resource: 'relations', catalogId, recordId })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }

  /**
   * Получение доступных для связывания записей
   * https://docs.bpium.ru/integrations/api/search/availablerecords
   * @param catalogId id текущего каталога
   * @param fieldId  id поля к котрому происходит подбор записей
   * @param params параметры запроса
   * ```
   * {
   *   title: "абв",//поисковая строка для фильтрации
   *   catalogId: "20"//ограничивает выдачу по определенному каталогу-источнику
   * }
   * ```
   * @return вернет список доступных для связвания записей
   */
  async getAvailableRecords(
    catalogId: ID,
    fieldId: ID,
    params?: { title?: string; catalogId?: ID; recordsFilters?: string }
  ): Promise<IBpLinkedRecord[]> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!fieldId) throw new Error(`fieldId is required`)
    let url = this._getUrl({ resource: 'availableRecords', catalogId, fieldId })
    let response = await this._request(url, 'GET', undefined, params)
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records#sozdat-zapis
   * Добавляет запись в каталог
   *
   * @param catalogId id каталога в который будет добавлена запись
   * @param data Данные для добавления в bpium {"2": "test text", "3": [1,2]}
   * @returns идентификатор созданной записи, пример - {"id": "31015"}
   */
  async postRecord(catalogId: ID, data: IBpValues = {}): Promise<IBpRecord> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!data || typeof data != 'object') throw new Error(`data must be an object`)
    const url = this._getUrl({ resource: 'record', catalogId })
    const response = await this._request(url, 'POST', { values: data })
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#sozdat-katalog
   * Создать каталог
   *
   * @param data объект описывающий создаваемый каталог с полями:
   * ```
   *name: 'New catalog',
   *icon: 'icon',
   *sectionId: '2',
   *fields: [
   *    {
   *      name: 'Секция',
   *      hint: '',
   *      type: 'group',
   *      config: {},
   *    },
   *    {
   *      name: 'Текст',
   *      hint: 'Подсказка к полю текст',
   *      type: 'text',
   *      config: {
   *        type: 'text',
   *      },
   *    },
   *    ...
   *    ]
   * }
   * ```
   * @returns вернет объект такого вида:
   * ```
   * { id: '119' }
   * ```
   */
  async postCatalog(data: Omit<IBpCatalog, 'id'>): Promise<{ id: string }> {
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'catalog' })
    const response = await this._request(url, 'POST', data)
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/sections#sozdat-otdel
   *
   * Добавление отдела
   * @param data
   * @returns
   */
  async postSection(data: Omit<IBpSection, 'id'>): Promise<{ id: string }> {
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'section' })
    const response = await this._request(url, 'POST', data)
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/istoriya-history#napisat-kommentarii
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @param {string} message
   * @returns Объект такого вида
   * ```
   * { id: '1' }
   * ```
   */
  async addCommentToHistory(catalogId: ID, recordId: ID, message: string): Promise<{ id: string }> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    if (!message) throw new Error(`message is required`)
    if (typeof message !== 'string') throw new Error(`message need to be a string`)
    const url = this._getUrl({ resource: 'histories' })
    const response = await this._request(url, 'POST', {
      catalogId,
      recordId,
      type: 'COMMENT',
      payload: { message: message },
    })
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records#izmenit-zapis
   * 
   * @param catalogId id каталога
   * @param recordId  id записи
   * @param data 
   * @returns Объект такого вида
   * ```
   * {
        id: '1',
        catalogId: '114',
        title: 'newText',
        values: { '2': 'newText', '4': [ '3' ] }
      }
   * ```
   */
  async patchRecord(catalogId: ID, recordId: ID, data: IBpValues): Promise<IBpRecord & { title: string | undefined }> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId })
    const response = await this._request(url, 'PATCH', { values: data })
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#izmenit-katalog
   * @param {int|string} catalogId id каталога
   * @param {Object} data если нет поля data.fields, то поля каталога НЕ будут затронуты патчем,
   * если же есть поле data.fields = [{name:'nameField', type:'text',...}, ...],
   * то все поля будут приведены к новому виду согласно данным в поле data.fields.
   * @returns пусто
   */
  async patchCatalog(catalogId: ID, data: Partial<IBpCatalog>): Promise<void> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'catalog', catalogId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }

  /**
   * Изменить отдел
   * https://docs.bpium.ru/integrations/api/data/sections#izmenit-otdel
   * @param sectionId id отдела
   * @param data Описание отдела
   * @returns пусто
   */
  async patchSection(sectionId: ID, data: IBpSection): Promise<void> {
    if (!sectionId) throw new Error(`sectionId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'section', sectionId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/views#izmenit-vid
   * Изменить вид
   *
   * @param catalogId id каталога
   * @param viewId
   * @param data
   * @returns
   */
  async patchView(catalogId: ID, viewId: ID, data: Partial<IBpView>): Promise<void> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!viewId) throw new Error(`viewId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'view', catalogId, viewId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/records#udalit-zapis
   * Удалить запись из каталога по id записи
   *
   * @param catalogId id каталога
   * @param recordId  id записи на удаление
   * @returns пусто
   */
  async deleteRecord(catalogId: ID, recordId: ID): Promise<void> {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId })
    const response = await this._request(url, 'DELETE')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#udalit-katalog
   * Удаляет каталог по его id
   *
   * @param  catalogId id каталог
   * @returns пустой ответ, если удаление успешное
   */
  async deleteCatalog(catalogId: ID): Promise<void> {
    throw new Error('function deleteCatalog is disabled')

    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'record', catalogId })
    const response = await this._request(url, 'DELETE')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/sections#udalit-otdel
   *
   * @param sectionId id удаляемого отдела
   * @returns пустой ответ, если удаление успешное
   */
  async deleteSection(sectionId: ID): Promise<void> {
    throw new Error('function deleteSection is disabled')

    if (!sectionId) throw new Error(`sectionId is required`)
    let url = this._getUrl({ resource: 'section', sectionId })
    let response = await this._request(url, 'DELETE')
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records
   * Получение списка записей с возможностью фильтрации, данные собираются несколькими походами 
   * по частям. Каждая часть ограничена параметром {limit} (по умолчанию limit = 500)
   *
   * @param {ID} catalogId id каталога
   * @param {Object} params параметры запроса ({limit:10} будет означать что каждый подход запроса 
   * данных будет ограничен этим лимитом, но целевое количество будет ограничено 3м аргуменом(maxLimit))
   * @param {int} maxLimit ограничение общего количества записей (по умолчанию = 5000)
   * @returns массив записей из каталога
   */
  async getAllRecords<ValuesType extends IBpValues>(
    catalogId: ID,
    params: IBpRecordsQueryFilter = {},
    maxLimit: number = 5000
  ): Promise<(IBpRecord<ValuesType>)[]> {
    if (!catalogId) throw new Error(`catalogId is required`)

    const initOffset = params.offset ?? 0
    const initChunkLimit = params.limit ?? 500
    const totalRecords: (IBpRecord<ValuesType>)[] = []

    while (totalRecords.length < maxLimit) {
      const fullDelta = maxLimit - totalRecords.length
      const chunkLimit = fullDelta <= initChunkLimit ? fullDelta : initChunkLimit
      const records = await this.getRecords<ValuesType>(catalogId, { ...params, limit: chunkLimit, offset: initOffset + totalRecords.length })
      totalRecords.push(...records)

      if (records.length < chunkLimit) break
    }

    return totalRecords
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/files#zagruzka-faila-v-failovoe-khranilishe-bpium
   * @param {string} name 
   * @param string} mimeType 
   * @param {string} typeStorage 
   * @returns вернет объект похожый на этот:
   * ```
   * {
        AWSAccessKeyId: 'nauzhm9iomxwJC0RIGXZ',
        acl: 'private',
        fileId: 31,
        fileKey: '3571/56a17ffa-8582-414b-bfd7-96b29b226859/README FILE.md',
        police: 'eyJleHBpcmF0aW9uIjoiMjAyOS0xMi0wMVQxMjowMDowMC4wMDBaIiwiY29uZGl0aW9ucyI6W3siYnVja2V0IjoiYnBpdW0tdXNlcmRhdGEifSxbInN0YXJ0cy13aXRoIiwiJGtleSIsIjM1NzEvNTZhMTdmZmEtODU4Mi00MTRiLWJmZDctOTZiMjliMjI2ODU5L1JFQURNRSBGSUxFLm1kIl0seyJhY2wiOiJwcml2YXRlIn0sWyJzdGFydHMtd2l0aCIsIiRDb250ZW50LVR5cGUiLCIiXV19',
        redirect: '/api/v1/files/upload?type=s3',
        signature: 'FVKqbkriqg1OFSlfgLeXjM+M2vE=',
        uploadUrl: 'https://storage.yandexcloud.net:443/bpium-userdata',
        name: 'README FILE.md',
        mimeType: 'text/markdown'
      }
   * ```
   */
  async getUploadFileKeys(name: string = '', mimeType = '', typeStorage = 'remoteStorage'): Promise<IFileKey> {
    let urlFile = this._getUrl({ resource: 'file' })
    let { data } = await this._request(urlFile, 'POST', {
      name: name,
      typeStorage: typeStorage,
    })
    const fileKeys = data as IFileKey
    fileKeys.name = name
    fileKeys.mimeType = mimeType
    return fileKeys
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/files#zagruzka-faila-v-failovoe-khranilishe-bpium
   * Загрузка файла в bpium по ключу
   * 
   * @param {*} fileKeys id ключа который получен в через метод getUploadFileKeys
   * @param {*} streamOrBuffer поток данных для отрпавки на сервер или буфер
   * @returns вернет объект похожый на этот:
   * ```
   * {
        src: 'https://storage.yandexcloud.net:443/bpium-userdata/3571/c994a2d2-7af4-401d-a31b-a175db708bb4/README FILE.md',
        mimeType: 'text/markdown',
        title: 'README FILE.md',
        size: 1902
      }
   * ```
   */
  async uploadFile(
    fileKeys: IFileKey,
    streamOrBuffer: stream.Readable | Buffer
  ): Promise<{ src: string; mimeType: string; title: string; size: number }> {
    if (!streamOrBuffer) throw new Error(`readble stream or buffer is required`)
    if (!fileKeys) throw new Error(`fileKeys is required. First use method getUploadFileKeys`)

    if (streamOrBuffer instanceof Buffer
      //@ts-ignore
      && !streamOrBuffer.name) {
      //@ts-ignore
      streamOrBuffer.name = 'file.json' //Нужно для работы с буфером
    }

    const formData = new FormData()
    formData.append('key', fileKeys.fileKey)
    formData.append('acl', 'private')
    formData.append('AWSAccessKeyId', fileKeys.AWSAccessKeyId)
    formData.append('Policy', fileKeys.police)
    formData.append('Signature', fileKeys.signature)
    formData.append('Content-Type', fileKeys.mimeType)
    formData.append('file', streamOrBuffer)

    const formHeaders: FormData.Headers = formData.getHeaders()
    const fileLength: number = await new Promise<number>((resolve, reject): void => {
      formData.getLength((err: Error | null, length: number) => {
        if (err !== null) {
          console.log(err)
          // this._error(err)
          reject(err)
        }
        resolve(length)
      })
    })
    try {
      await axios.request({
        method: 'POST',
        url: fileKeys.uploadUrl,
        data: formData,
        headers: {
          ...formHeaders,
          'Content-Length': fileLength,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      })
      return {
        src: `${fileKeys.uploadUrl}/${fileKeys.fileKey}`,
        mimeType: fileKeys.mimeType,
        title: fileKeys.name,
        size: fileLength,
      }
    } catch (e) {
      console.log(e)
      throw e
    }
  }

  /**
   * Удобный таймер сделан для получения паузы в асинхронных функциях
   * Использовать можно так:
   * ```
   *   await bp.pause(30000) //pause 30sec
   * ```
   * @param {} timer 500 по умолчанию
   * @returns вернет Promise который будет обрабатываться ровно timer милисекунд
   */
  async pause(timer: number = 500): Promise<boolean> {
    return new Promise(function (resolve, reject) {
      setTimeout(() => {
        resolve(true)
      }, timer)
    })
  }


}

export default BP
export * from './interfaces'
export * from './values'