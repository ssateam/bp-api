const axiosMock = jest.mock('axios')
const axios = require('axios')
const BP = require('./index')

afterAll(() => { axios.mockRestore() })

const domen = 'domen'
const login = 'login'
const pass = 'pass'


test('create BP', () => {
  const bp = new BP(domen, login, pass)
  expect(bp).toBeInstanceOf(BP)
})

test("minimal node version 14", () => {
  expect(process.versions.node).toMatch(/^14\..*/)
})

test("Test guard expression new BP", () => {
  expect(() => new BP()).toThrow(Error)
  expect(() => new BP(domen)).toThrow(Error)
  expect(() => new BP(domen, login)).toThrow(Error)
  expect(() => new BP(domen, login, pass)).not.toThrow(Error)
})

const dataOk = { status: 200, data: { 'key': 'value' } }
const data400 = { status: 200, data: { 'key': 'value' } }

const getBp = () => {
  axios.mockResolvedValue(dataOk)
  return new BP(domen, login, pass)
}

test("Test guard expresstion BP methods", async () => {
  const bp = getBp()

  await expect(bp.getRecordById()).rejects.toThrow(Error)
  await expect(bp.getRecordById('1')).rejects.toThrow(Error)
  await expect(bp.getRecordById('1', '2')).resolves.toBe(dataOk.data)

  axios.mockRejectedValueOnce(new Error(data400))
  await expect(bp.getRecordById('1', '2')).rejects.toThrow(Error)
})
