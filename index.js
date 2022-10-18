const axios = require('axios')
const qs = require('qs')
const _ = require('lodash')
const FormData = require('form-data')

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
 */
class BP {
  /**
   * Конструктор объекта для последующей работы с api bpium
   * @param {string} domen домен 
   * @param {string} login логин
   * @param {string} password пароль
   * @param {string} protocol протокол, по умолчанию https
   * @param {int} timeout по умолчанию 30 секунд 
   */
  constructor(domen, login, password, protocol = 'https', timeout = 30000) {
    if (!domen) throw new Error(`domen can't be empty`)
    if (!login) throw new Error(`login can't be empty`)
    if (!password) throw new Error(`password can't be empty`)

    this.login = login
    this.password = password
    this.timeout = timeout
    this.protocol = protocol
    this.domen = domen
    this.baseUrl = `${protocol}://${domen}/api/v1`
  }

  _getUrl(opt) {
    switch (opt.resource) {
      case 'record':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/records/${opt.recordId ? opt.recordId : ''}`
      case 'catalog':
        return `${this.baseUrl}/catalogs/${opt.catalogId ? opt.catalogId : ''}`
      case 'section':
        return `${this.baseUrl}/sections/${opt.sectionId}`
      case 'view':
        return `${this.baseUrl}/catalogs/${opt.catalogId}/views/${opt.viewId}`
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
    }
  }

  /**
   * Обновляет сессию 
   * @returns ответ на запрос авторизации
   */
  async _updateAuth() {
    const authUrl = this._getUrl({ resource: 'login' })
    const authResult = await axios({
      auth: {
        username: this.login,
        password: this.password,
      },
      timeout: this.timeout,
      url: authUrl,
      method: 'GET',
      headers: {
        "Content-type": "application/x-www-form-urlencoded"
      },
      maxRedirects: 0,
    })
    const setCookies = _.get(authResult, 'headers["set-cookie"]', [])
    const sidCookieRaw = setCookies.find(item => item.startsWith('connect.sid=')) || ''
    this.sidCookie = sidCookieRaw.replace(/(connect\.sid\=[^;]+);.*$/gm, '$1')

    return authResult
  }

  /**
   * @param {string} url к ресурсу
   * @param {string} method метод обращения к ресурсу
   * @param {Object} data параметры тела запроса
   * @param {Object} params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  async _requestWithAuthCookie(url, method, data = {}, params = {}) {
    return await axios({
      timeout: this.timeout,
      url: url,
      method: method,
      params: params,
      paramsSerializer: function (params) {
        return qs.stringify(params)
      },
      headers: {
        "Cookie": this.sidCookie,
        'Content-type': 'application/json',
      },
      data: data,
    })
  }
  /**
   * @param { string } url к ресурсу
   * @param { string } method метод обращения к ресурсу
   * @param { Object } data параметры тела запроса
   * @param { Object } params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  async _requestWithAuthBasic(url, method, data = {}, params = {}) {
    return await axios({
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
  }

  /**
   * https://docs.bpium.ru/integrations/api
   * 
   * @param {string} url к ресурсу
   * @param {string} method метод обращения к ресурсу
   * @param {Object} data параметры тела запроса
   * @param {Object} params параметры запроса
   * @returns вернет полный ответ из библиотеки axios
   */
  async _request(url, method, data = {}, params = {}) {
    if (!this.sidCookie) {
      await this._updateAuth()
    }
    try {
      return await this._requestWithAuthCookie(url, method, data, params)
    } catch (e1) {
      const isAuthError = _.get(e1, 'response.status', 0) === 401
      if (this.sidCookie && isAuthError) {
        try {
          await this._updateAuth()
          return await this._requestWithAuthCookie(url, method, data, params)
        } catch (e2) {
          const isAuthError = _.get(e2, 'response.status', 0) === 401
          if (isAuthError) {
            return await this._requestWithAuthBasic(url, method, data, params)
          }
          else {
            throw e2
          }
        }
      } else {
        throw e1
      }
    }
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records#poluchit-zapis
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @param {Object} params  набор возвращаемых полей записей, формат: ["2", "3"]
   * @returns Вернет запись из каталога catalogId и id равный recordId
   */
  async getRecordById(catalogId, recordId, params = {}) {
    if (!recordId) throw new Error(`recordId is required`)
    if (!catalogId) throw new Error(`catalogId is required`)
    let url = this._getUrl({ resource: 'record', catalogId, recordId })
    let response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/records#poluchit-zapisi
   * @param {int|string} catalogId  id каталога
   * @param {Object} params описание параметров в ссылке. 
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
  async getRecords(catalogId, params = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId: '' })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#poluchit-katalog
   * @param {int|string} catalogId id каталога
   * @returns если catalogId не пусто, то вернет описание полей каталога в виде объекта https://docs.bpium.ru/integrations/api/data/catalogs#poluchit-katalog
   * , если catalogId пустой, то вернет массив описаний всех каталогов 
   */
  async getCatalog(catalogId = '') {
    const url = this._getUrl({ resource: 'catalog', catalogId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/sections#poluchit-otdely
   * @param {int|string} sectionId id отдела
   * @returns если sectionId не пусто, вернет объект описания найденного по sectionId отдела,
   *  если sectionId пустой, то  вернет массив всех отделов.
   */
  async getSection(sectionId = '') {
    const url = this._getUrl({ resource: 'section', sectionId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/views#poluchit-vidy
   * @param {int|string} catalogId id каталога
   * @param {int|string} viewId id вида
   * @returns вернет массив видов для каталога если viewId пусто,
   * вернет один вид если viewId не пустой
   */
  async getView(catalogId, viewId = '') {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'view', viewId, catalogId })
    const response = await this._request(url, 'GET')
    return response.data
  }
  /**
   * https://docs.bpium.ru/manual/reports/widgets
   * @param {int|string} boardId 
   * @param {Object} params параметры запроса
   * @param {int|string} widgetId 
   * @param {*} type 
   * @returns 
   */
  async getWidget(boardId, params = {}, widgetId = 'new', type = 'values') {
    if (!boardId) throw new Error(`boardId is required`)
    const url = this._getUrl({ resource: 'board', boardId, widgetId, type })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/istoriya-history
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId id записи
   * @param {Object} params параметры запроса (см. ссылку)
   * @returns вернет массив записей истории. Если recordId не указан, то вернет историю по всему каталогу
   * 
   */
  async getHistory(catalogId, recordId = '', params = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (recordId) params.recordId = recordId
    params.catalogId = catalogId
    const url = this._getUrl({ resource: 'histories' })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * Агрегация. Разложение данных по осям
   * https://docs.bpium.ru/integrations/api/agregate/values
   * @param {int|string} catalogId  id каталога
   * @param {Object} params параметры запроса
   * @returns 
   */
  async getValues(catalogId, params = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'values', catalogId })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * Получение связей с записью 
   * https://docs.bpium.ru/integrations/api/data/relations-relations
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @param {Object} params параметры запроса
   * @returns вернет массив связей
   */
  async getRelations(catalogId, recordId, params = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    const url = this._getUrl({ resource: 'relations', catalogId, recordId })
    const response = await this._request(url, 'GET', undefined, params)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/records 
   * Добавляет запись в каталог 
   * @param {int|string} catalogId id каталога в который будет добавлена запись
   * @param {Object} data Данные для добавления в bpium {"2": "test text", "3": [1,2]}
   * @returns идентификатор созданной записи, пример - {"id": "31015"}
   */
  async postRecord(catalogId, data = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    const url = this._getUrl({ resource: 'record', catalogId })
    const response = await this._request(url, 'POST', { values: data })
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs
   * Создать каталог
   * 
   * @param {Object} data объект описывающий создаваемый каталог с полями:
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
  async postCatalog(data = {}) {
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'catalog' })
    const response = await this._request(url, 'POST', data)
    return response.data
  }
  /**
   * 
   * @param {Object} data 
   * @returns 
   */
  async postSection(data = {}) {
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'section' })
    const response = await this._request(url, 'POST', data)
    return response.data
  }
  /**
   * 
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @param {Object} data 
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
  async patchRecord(catalogId, recordId, data = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId })
    const response = await this._request(url, 'PATCH', { values: data })
    return response.data
  }
  /**
   * 
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @param {string} message 
   * @returns Объект такого вида
   * ```
   * {
        id: '1'
      }
   * ```
   */
  async addCommentToHistory(catalogId, recordId, message) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    if (!message) throw new Error(`message is required`)
    if (typeof message !== 'string') throw new Error(`message need to be a string`)
    const url = this._getUrl({ resource: 'histories', catalogId, recordId })
    const response = await this._request(url, 'POST', { "catalogId": catalogId, "recordId": recordId, "type": "COMMENT", "payload": { "message": message } })
    return response.data
  }
  /**
   * 
   * @param {int|string} catalogId id каталога
   * @param {Object} data если нет поля data.fields, то поля каталога НЕ будут затронуты патчем, 
   * если же есть поле data.fields = [{name:'nameField', type:'text',...}, ...], 
   * то все поля будут приведены к новому виду согласно данным в поле data.fields.
   * @returns пусто
   */
  async patchCatalog(catalogId, data = {}) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'catalog', catalogId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }
  /**
   * Изменить отдел
   * https://docs.bpium.ru/integrations/api/data/sections
   * @param {int|string} sectionId id отдела
   * @param {Object} data 
   * @returns 
   */
  async patchSection(sectionId, data = {}) {
    if (!sectionId) throw new Error(`sectionId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'section', sectionId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }
  /**
   * Изменить вид
   * https://docs.bpium.ru/integrations/api/data/views
   * 
   * @param {int|string} catalogId id каталога
   * @param {int|string} viewId 
   * @param {Object} data 
   * @returns 
   */
  async patchView(catalogId, viewId, data = {}) {
    if (!catalogId) throw new Error(`sectionId is required`)
    if (!viewId) throw new Error(`viewId is required`)
    if (typeof data != 'object') throw new Error(`data must be an object`)
    if (_.isEmpty(data)) throw new Error(`data cant't be empty`)
    const url = this._getUrl({ resource: 'view', catalogId, viewId })
    const response = await this._request(url, 'PATCH', data)
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/records
   * Удалить запись из каталога по id записи
   * @param {int|string} catalogId id каталога
   * @param {int|string} recordId  id записи
   * @returns пусто
   */
  async deleteRecord(catalogId, recordId) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!recordId) throw new Error(`recordId is required`)
    const url = this._getUrl({ resource: 'record', catalogId, recordId })
    const response = await this._request(url, 'DELETE')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/catalogs#udalit-katalog
   * Удаляет каталог по его id 
   * @param {int|string} catalogId id каталог
   * @returns пустой ответ, если удаление успешное
   */
  async deleteCatalog(catalogId) {
    console.log(`function is disabled!`)
    return
    if (!catalogId) throw new Error(`catalogId is required`)
    const url = this._getUrl({ resource: 'record', catalogId })
    const response = await this._request(url, 'DELETE')
    return response.data
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/sections#udalit-otdel
   * @param {int|string} sectionId id удаляемого отдела
   * @returns пустой ответ, если удаление успешное
   */
  async deleteSection(sectionId) {
    console.log(`function is disabled!`)
    return
    if (!catalogId) throw new Error(`sectionId is required`)
    let url = this._getUrl({ resource: 'section', sectionId })
    let response = await this._request(url, 'DELETE')
    return response.data
  }

  /**
   * https://docs.bpium.ru/integrations/api/data/records
   * 
   * @param {string|int} catalogId id каталога
   * @param {Object} params  параметры запроса
   * @param {int} maxLimit ограничение количества записей
   * @returns массив записей из каталога
   */
  async getAllRecords(catalogId, params = {}, maxLimit = 5000) {
    if (!catalogId) throw new Error(`catalogId is required`)
    if (!params.limit) params.limit = 1000
    if (!params.offset) params.offset = 0
    let records = { length: params.limit }
    let totalRecords = []
    if (records.length == params.limit) {
      while (records.length > 0 && totalRecords.length < maxLimit) {
        records = await this.getRecords(catalogId, params)
        params.offset += params.limit
        totalRecords = _.concat(totalRecords, records)
      }
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
  async getUploadFileKeys(name = '', mimeType = '', typeStorage = 'remoteStorage') {
    let urlFile = this._getUrl({ resource: 'file' })
    let { data: fileKeys } = await this._request(urlFile, 'POST', {
      name: name,
      typeStorage: typeStorage,
    })
    fileKeys.name = name
    fileKeys.mimeType = mimeType
    return fileKeys
  }
  /**
   * https://docs.bpium.ru/integrations/api/data/files#zagruzka-faila-v-failovoe-khranilishe-bpium
   * @param {*} fileKeys id ключа который получен в через метод getUploadFileKeys
   * @param {*} stream поток данных для отрпавки на сервер
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
  async uploadFile(fileKeys, stream) {
    if (!stream) throw new Error(`readble stream is required`)
    if (!fileKeys) throw new Error(`fileKeys is required. First use method getUploadFileKeys`)
    let formData = new FormData()
    formData.append('key', fileKeys.fileKey)
    formData.append('acl', 'private')
    formData.append('AWSAccessKeyId', fileKeys.AWSAccessKeyId)
    formData.append('Policy', fileKeys.police)
    formData.append('Signature', fileKeys.signature)
    formData.append('Content-Type', fileKeys.mimeType)
    formData.append('file', stream)

    let formHeaders = formData.getHeaders()
    let fileLength = await new Promise((resolve, reject) => {
      formData.getLength(async function (err, length) {
        if (err) {
          console.log(err)
          this._error(err)
          reject(err)
        }
        resolve(length)
      })
    })
    try {
      await axios({
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
  async pause(timer = 500) {
    return new Promise(function (resolve, reject) {
      setTimeout(() => {
        resolve()
      }, timer)
    })
  }
}

module.exports = BP
