import { expect, jest, test } from '@jest/globals'
jest.mock('axios')
import BP from '../src/index'
import axios from 'axios'

const mockedAxios = axios as jest.Mocked<typeof axios>

afterAll(() => {
  jest.restoreAllMocks()
})

const domen = 'domen'
const login = 'login'
const pass = 'pass'

describe('simple mock tests', () => {
  test('create BP', () => {
    const bp = new BP(domen, login, pass)
    expect(bp).toBeInstanceOf(BP)
  })

  test('minimal node version 14', () => {
    expect(process.versions.node).toMatch(/^14\..*/)
  })

  test('Test guard expression new BP', () => {
    expect(() => new BP(domen, login, pass)).not.toThrow(Error)
  })

  const dataOk = { status: 200, data: { key: 'value' } }
  const data400 = { status: 200, data: { key: 'value' } }

  const getBp = () => {
    mockedAxios.request.mockResolvedValue(dataOk)
    return new BP(domen, login, pass)
  }

  test('Test guard expresstion BP methods', async () => {
    const bp = getBp()

    await expect(bp.getRecordById('1', '2')).resolves.toBe(dataOk.data)

    mockedAxios.request.mockRejectedValueOnce(new Error(''))
    await expect(bp.getRecordById('1', '2')).rejects.toThrow(Error)
  })
})
