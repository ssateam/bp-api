const fs = require('fs')
const moment = require('moment')
const config = require('./config')
const testCatalogStruct = {
  name: 'New catalog',
  icon: 'icon',
  sectionId: '2',
  fields: [
    {
      name: 'Секция',
      hint: '',
      type: 'group',
      config: {},
    },
    {
      name: 'Текст',
      hint: 'Подсказка к полю текст',
      type: 'text',
      config: {
        type: 'text',
      },
    },
    {
      name: 'Дата',
      hint: '',
      type: 'date',
      config: {
        time: false,
        notificationField: null,
      },
    },
    {
      name: 'Набор галочек',
      hint: '',
      type: 'checkboxes',
      config: {
        items: [
          {
            name: '1',
          },
          {
            name: '2',
          },
          {
            name: '3',
          },
        ],
      },
    },
    {
      name: 'Прогресс',
      hint: '',
      type: 'progress',
      config: {},
    },
    {
      name: 'Сотрудник',
      hint: '',
      type: 'user',
      config: {
        multiselect: false,
      },
    },
    {
      name: 'Связанный объект',
      hint: '',
      type: 'object',
      config: {
        multiselect: false,
        catalogs: [
          {
            id: '11',
          },
        ],
      },
    },
    {
      name: 'Файл',
      hint: '',
      type: 'file',
      config: {
        multiselect: false,
      },
    },
  ],
}

const testCatalogStruct2 = {
  name: 'New catalog2',
  icon: 'icon',
  sectionId: '2',
  fields: [
    {
      name: 'Секция2',
      hint: '',
      type: 'group',
      config: {},
    },
    {
      name: 'Текст2',
      hint: 'Подсказка к полю текст2',
      type: 'text',
      config: {
        type: 'text',
      },
    }, {
      name: 'link',
      hint: 'Связь с другой записью',
      type: 'object',
      config: {
        multiselect: true,
        catalogs: [{
          "id": "?"
        }]
      }
    }]
}

it('config file is present and correct', () => {
  expect(config).toHaveProperty('domen')
  expect(config).toHaveProperty('username')
  expect(config).toHaveProperty('password')
})

describe('test on live bpium', () => {
  if (!config) throw new Error('config.js should be defined')
  jest.setTimeout(30000)
  const BP = require('./index')
  const bp = new BP(config.domen, config.username, config.password, config.protocol)
  let tempCatalogId = null
  let tempCatalog = null
  let tempRecordId = null
  let tempCatalogId2 = null
  let tempCatalog2 = null
  let tempRecordId2 = null


  const createTempCatalogs = async () => {
    const resultPostCatalog = (await bp.postCatalog(testCatalogStruct))
    tempCatalogId = resultPostCatalog.id

    testCatalogStruct2.fields[2].config.catalogs[0].id = tempCatalogId
    const resultPostCatalog2 = (await bp.postCatalog(testCatalogStruct2))
    tempCatalogId2 = resultPostCatalog2.id

    tempCatalog = await bp.getCatalog(tempCatalogId)
    tempRecordId = (
      await bp.postRecord(tempCatalogId, {
        2: 'test',
        3: moment(),
        4: [1, 2],
      })
    ).id

    tempCatalog2 = await bp.getCatalog(tempCatalogId2)
    tempRecordId2 = (
      await bp.postRecord(tempCatalogId2, {
        2: 'test',
        3: [{ catalogId: tempCatalogId, recordId: tempRecordId }],
      })
    ).id
  }

  const removeTempCatalogs = async () => {
    const catalogsUrl = bp._getUrl({ resource: 'catalog', catalogId: tempCatalogId })
    await bp._request(catalogsUrl, 'DELETE')

    const catalogsUrl2 = bp._getUrl({ resource: 'catalog', catalogId: tempCatalogId2 })
    await bp._request(catalogsUrl2, 'DELETE')
  }

  beforeAll(() => {
    return createTempCatalogs()
  })

  afterAll(() => {
    return removeTempCatalogs()
  })

  it('Test unathorized access', async () => {
    const BP = require('./index')
    const wrongPassUser = config.username + 'wrong'

    const bpWrong = new BP(config.domen, wrongPassUser, wrongPassUser, config.protocol)
    const spy_requestWithAuthBasic = jest.spyOn(bpWrong, '_requestWithAuthBasic')

    await expect(bpWrong.getRecords(100000)).rejects.toThrow(Error)
    await expect(bpWrong.getRecords(tempCatalogId)).rejects.toThrow(Error)

    expect(spy_requestWithAuthBasic).not.toBeCalled()
  })

  it('Test width closed session ', async () => {
    const BP = require('./index')
    const mockbpCookieTest = new BP(config.domen, config.username, config.password, config.protocol)
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')

    //Портим сессию
    mockbpCookieTest.sidCookie = 'badSessionCookieString'
    const spy_requestWithAuthBasic = jest.spyOn(mockbpCookieTest, '_requestWithAuthBasic')
    const spy_updateAuth = jest.spyOn(mockbpCookieTest, '_updateAuth')
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')
    expect(spy_updateAuth).toBeCalled()
    expect(spy_requestWithAuthBasic).not.toBeCalled()
  })

  it('Test width bad session access and last basicRequest', async () => {
    const BP = require('./index')

    const mockbpCookieTest = new BP(config.domen, config.username, config.password, config.protocol)
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')

    //Портим доступ по сессии
    Object.defineProperty(mockbpCookieTest, 'sidCookie', {
      get: function () { return 'badSessionCookieString' },
      set: function (newValue) { },
    })

    const spy_requestWithAuthBasic = jest.spyOn(mockbpCookieTest, '_requestWithAuthBasic')
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')
    expect(spy_requestWithAuthBasic).toBeCalled()
  })

  it('Test patch catalog', async () => {
    expect(tempCatalog).toHaveProperty('name', testCatalogStruct.name)
    await bp.patchCatalog(tempCatalog.id, { name: "Changed name catalog" })

    const updatedCatalog = await bp.getCatalog(tempCatalogId)
    expect(updatedCatalog).toHaveProperty('name', "Changed name catalog")
    expect(updatedCatalog).toHaveProperty('fields[0].name', 'Секция')
    expect(updatedCatalog).toHaveProperty('fields[1].type', 'text')
  })

  it('Test is present catalog with record', async () => {
    expect(tempCatalog).toHaveProperty('id', '' + tempCatalogId)
    await expect(bp.getRecords(tempCatalog.id)).resolves.toHaveProperty('[0].catalogId', tempCatalogId)

    await expect(bp.getSection()).resolves.toHaveProperty('[0].id')
    await expect(bp.getSection(tempCatalog.sectionId)).resolves.toHaveProperty('id', tempCatalog.sectionId)
  })

  it('Test add and remove record', async () => {
    const { id: newRecordId } = await bp.postRecord(tempCatalogId, { '2': 'just some text' })
    expect(newRecordId).not.toBeNull()
    await bp.deleteRecord(tempCatalogId, newRecordId)

    //bp.getRecordById(tempCatalog, newRecordId) <= Очень плохой код,- здесь нет await и нет блока .catch (а должно быть хотябы чтото одно!)
    try {
      await bp.getRecordById(tempCatalog, newRecordId)
      fail('it should not reach here')
    } catch (e) {
      expect(e).toHaveProperty('response.data.code', 404)
    }
  })

  it('Test add record with link', async () => {
    const { id: newRecordId } = await bp.postRecord(tempCatalogId2, {
      '2': 'some test',
      '3': [{ catalogId: tempCatalogId, recordId: tempRecordId }]
    })
    expect(newRecordId).not.toBeNull()

    const newRecord = await bp.getRecordById(tempCatalogId2, newRecordId, { fields: [2, { id: 3 }] })
    // console.log('newRecord = ', JSON.stringify(newRecord, null, 2))

  })

  it('Test patch field', async () => {
    const record = await bp.getRecordById(tempCatalogId, tempRecordId) 
    expect(record).toHaveProperty('id', '1')
    expect(record).toHaveProperty('values.[2]', 'test')
    expect(record).toHaveProperty('values.[4]', ['1', '2'])

    const resultPatch = await bp.patchRecord(tempCatalogId, tempRecordId, { 4: ['3'], 2: 'newText' })

    const patchedRecord = await bp.getRecordById(tempCatalogId, tempRecordId)
    expect(patchedRecord).toHaveProperty('values.[4]', ['3'])
    expect(patchedRecord).toHaveProperty('values.[2]', 'newText')
  })

  it('Test file methods', async () => {
    const stream = fs.createReadStream(`${__dirname}/README.md`)
    const keyFile = await bp.getUploadFileKeys('README FILE.md', 'text/markdown')
    expect(keyFile).toHaveProperty('AWSAccessKeyId')
    expect(keyFile).toHaveProperty('acl', 'private')
    expect(keyFile).toHaveProperty('fileId')
    expect(keyFile).toHaveProperty('fileKey')
    expect(keyFile).toHaveProperty('police')
    expect(keyFile).toHaveProperty('redirect')
    expect(keyFile).toHaveProperty('signature')
    expect(keyFile).toHaveProperty('uploadUrl')
    expect(keyFile).toHaveProperty('name', 'README FILE.md')
    expect(keyFile).toHaveProperty('mimeType', 'text/markdown')

    const resultUploadFile = await bp.uploadFile(keyFile, stream)
    expect(resultUploadFile).toHaveProperty('src')
    expect(resultUploadFile).toHaveProperty('size')
    expect(resultUploadFile).toHaveProperty('mimeType', 'text/markdown')
    expect(resultUploadFile).toHaveProperty('title', 'README FILE.md')

    bp.patchRecord(tempCatalog.id, tempRecordId, { 8: [{ id: keyFile.fileId }] })
  })
})
