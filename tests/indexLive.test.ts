import { IBpCatalog, IBpCatalogField, ID } from '../src/interfaces'

import fs from 'fs'
import moment from 'moment'
import config from '../config'
import BP from '../src/index'

const testCatalogStruct: IBpCatalog = {
  name: 'Test-New catalog',
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
        multiselect: true,
      },
    },
  ],
}

const testCatalogStruct2: Omit<IBpCatalog, 'id'> = {
  name: 'Test- New catalog2',
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
    },
    {
      name: 'link',
      hint: 'Связь с другой записью',
      type: 'object',
      config: {
        multiselect: true,
        catalogs: [
          {
            id: '?',
          },
        ],
      },
    },
  ],
}

it('config file is present and correct', () => {
  expect(config).toHaveProperty('domen')
  expect(config).toHaveProperty('username')
  expect(config).toHaveProperty('password')
})

describe('test on live bpium', () => {
  if (!config) throw new Error('config.js should be defined')
  jest.setTimeout(30000)

  const bp = new BP(config.domen, config.username, config.password, config.protocol)
  let tempCatalogId: ID
  let tempCatalog: IBpCatalog
  let tempRecordId: ID
  let tempCatalogId2: ID
  let tempCatalog2: IBpCatalog
  let tempRecordId2: ID

  const createTempCatalogs = async () => {
    const resultPostCatalog = await bp.postCatalog(testCatalogStruct)
    tempCatalogId = resultPostCatalog.id

    testCatalogStruct2.fields[2].config!.catalogs[0].id = tempCatalogId
    const resultPostCatalog2 = await bp.postCatalog(testCatalogStruct2)
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

  /**
   * Удаляем все каталоги  с именем начинающимся с "Test-"
   */
  const removeTempCatalogs = async () => {
    const catalogs: IBpCatalog[] = await bp.getCatalog()

    const catalogsToRemove = catalogs.filter((item: IBpCatalog) => item.name.startsWith('Test-'))
    for (let catalog of catalogsToRemove) {
      const catalogRemoveUrl = bp._getUrl({ resource: 'catalog', catalogId: catalog.id })
      await bp['_request'](catalogRemoveUrl, 'DELETE')
    }
  }

  beforeAll(() => {
    return createTempCatalogs()
  })

  afterAll(() => {
    return removeTempCatalogs()
  })

  it('Test unathorized access', async () => {
    const wrongPassUser = config.username + 'wrong'

    const bpWrong = new BP(config.domen, wrongPassUser, wrongPassUser, config.protocol)
    const spy_requestWithAuthBasic = jest.spyOn(bpWrong as any, '_requestWithAuthBasic')

    await expect(bpWrong.getRecords(100000)).rejects.toThrow(Error)
    await expect(bpWrong.getRecords(tempCatalogId)).rejects.toThrow(Error)

    expect(spy_requestWithAuthBasic).toBeCalledTimes(2)
  })

  it('Test width closed session ', async () => {
    const mockbpCookieTest = new BP(config.domen, config.username, config.password, config.protocol)
    const spy_requestWithAuthBasic = jest.spyOn(mockbpCookieTest as any, '_requestWithAuthBasic')

    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')

    //Портим сессию
    Reflect.set(mockbpCookieTest, 'sidCookie', 'badSessionCookieString')

    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')
    expect(spy_requestWithAuthBasic).toBeCalledTimes(2)
  })

  it('Test width bad session access and last basicRequest', async () => {
    const mockbpCookieTest = new BP(config.domen, config.username, config.password, config.protocol)
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')

    //Портим доступ по сессии
    Object.defineProperty(mockbpCookieTest, 'sidCookie', {
      get: function () {
        return 'badSessionCookieString'
      },
      set: function (newValue) { },
    })

    const spy_requestWithAuthBasic = jest.spyOn(mockbpCookieTest as any, '_requestWithAuthBasic')
    await expect(mockbpCookieTest.getCatalog()).resolves.toHaveProperty('[0].fields')
    expect(spy_requestWithAuthBasic).toBeCalled()
  })

  it('Test patch catalog', async () => {
    expect(tempCatalog).toHaveProperty('name', testCatalogStruct.name)
    await bp.patchCatalog(tempCatalog.id!, { name: 'Test- Changed name catalog' })

    const updatedCatalog = await bp.getCatalog(tempCatalogId)
    expect(updatedCatalog).toHaveProperty('name', 'Test- Changed name catalog')
    expect(updatedCatalog).toHaveProperty('fields[0].name', 'Секция')
    expect(updatedCatalog).toHaveProperty('fields[1].type', 'text')
  })

  it('Test is present catalog with record', async () => {
    expect(tempCatalog).toHaveProperty('id', '' + tempCatalogId)
    await expect(bp.getRecords(tempCatalog.id!)).resolves.toHaveProperty('[0].catalogId', tempCatalogId)

    await expect(bp.getSection()).resolves.toHaveProperty('[0].id')
    await expect(bp.getSection(tempCatalog!.sectionId)).resolves.toHaveProperty('id', tempCatalog!.sectionId)
  })

  it('Test add and remove record', async () => {
    const { id: newRecordId } = await bp.postRecord(tempCatalogId, { '2': 'just some text' })
    expect(newRecordId).not.toBeNull()
    await bp.deleteRecord(tempCatalogId, newRecordId)

    //bp.getRecordById(tempCatalog, newRecordId) <= Очень плохой код,- здесь нет await и нет блока .catch (а должно быть хотябы чтото одно!)
    try {
      await bp.getRecordById(tempCatalog.id!, newRecordId)
      fail('it should not reach here')
    } catch (e) {
      // console.log(e)
      expect(e).toHaveProperty('response.status', 404)
      expect(e).toHaveProperty('response.data.name', 'NotFound')
    }

    try {
      await Reflect.apply(bp.postRecord, bp, [tempCatalog, { 1000: [1, 2, 3] }])
      fail('it should not reach here')
    } catch (e) {
      expect(e).toHaveProperty('response.status', 404)
      expect(e).toHaveProperty('response.data.name', 'NotFound')
    }
  })

  it('Test add record with link', async () => {
    const { id: newRecordId } = await bp.postRecord(tempCatalogId2, {
      '2': 'some test',
      '3': [{ catalogId: tempCatalogId, recordId: tempRecordId }],
    })
    expect(newRecordId).not.toBeNull()

    const newRecord = await bp.getRecordById(tempCatalogId2, newRecordId, { fields: [2, { fieldId: 3, fields: { [tempCatalogId]: ['1', '2', '3'] } }] })
    expect(newRecord.values[3][0].recordValues[2]).toEqual('test')
    // console.log('tempCatalogId = ', tempCatalogId, 'newRecord = ', JSON.stringify(newRecord, null, 2))
  })

  it('Test a linked field for getAvailableRecords', async () => {
    const records = await bp.getAvailableRecords(tempCatalogId, 7 /*Связанный объект*/, { title: 'комп' })
    expect(records).toHaveLength(1)
    expect(records[0]).toHaveProperty('catalogId', '11')
    expect(records[0]).toHaveProperty('recordId', '1')
    expect(records[0]).toHaveProperty('catalogTitle', 'Компании')
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
  it('Test add comment to history', async () => {
    const response = await bp.addCommentToHistory(tempCatalogId, tempRecordId, 'test comment text')
    expect(response.id).not.toBeNull()

    const history = await bp.getHistory(tempCatalogId, tempRecordId)
    expect(history).toHaveProperty('[0].payload.message', 'test comment text')
  })

  it('Test select with complex filter', async () => {
    await bp.postRecord(tempCatalogId, { '2': '1', '4': [] })
    await bp.postRecord(tempCatalogId, { '2': '1', '4': [2] })
    await bp.postRecord(tempCatalogId, { '2': '3', '4': [3] })
    await bp.postRecord(tempCatalogId, { '2': '2,3', '4': [2, 3] })

    const result1And2 = await bp.getRecords(tempCatalogId, { filters: [{ fieldId: 4, value: [2, 3] }] })
    expect(result1And2).toHaveLength(1)

    const records = await bp.getRecords(tempCatalogId, {
      filters: JSON.stringify({
        $and: [{ 2: '1' }, { 4: { $or: [[1, 2], [2]] } }],
      }),
    })
    // console.log(JSON.stringify(records, null, '  '))
  })

  it('Test file methods', async () => {
    const stream = fs.createReadStream(`${__dirname}/../README.md`)
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

    await bp.patchRecord(tempCatalog.id!, tempRecordId, { 8: [{ id: keyFile.fileId }] })
    const tempRecord = await bp.getRecordById(tempCatalog.id!, tempRecordId)

    //Второй раз использовать id файла нельзя(!!!), но можно сделать ссылку на этот файл,  При этом в БД создается новая запись к файлу,
    //но физически файл остается один
    const secondTimeFileLink = { title: tempRecord.values[8][0].title, src: tempRecord.values[8][0].url }
    const secondUseFile = await bp.postRecord(tempCatalog.id!, { 8: [secondTimeFileLink] })
  })

  it('Test file methods pass param as buffer', async () => {
    const newRecord = await bp.postRecord(tempCatalogId)
    const keyFile = await bp.getUploadFileKeys('analize.json', 'application/json')

    const data = JSON.stringify({ a: { b: [1, 2, 3, 4, 5] }, param: 'Hello!' })
    const buffer: any = Buffer.from(data)
    //ВАЖНО! нужно в буфер подать имя файла (оно нигде не отразиться как имя, но без этого работать не будет!)
    //Это изза библиотеки form-data/lib/form.data.js
    //строка =>  } else if (options.filename || value.name || value.path) {
    buffer.name = 'file.json'
    // console.log('buffer = ', buffer.toString())
    const resultUploadFile = await bp.uploadFile(keyFile, buffer)
    expect(resultUploadFile).toHaveProperty('src')
    expect(resultUploadFile).toHaveProperty('size')
    expect(resultUploadFile).toHaveProperty('mimeType', 'application/json')
    expect(resultUploadFile).toHaveProperty('title', 'analize.json')

    await bp.patchRecord(tempCatalog.id!, newRecord.id, { 8: [{ id: keyFile.fileId }] })
    const tempRecord = await bp.getRecordById(tempCatalog.id!, newRecord.id)
  })
})
