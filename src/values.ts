/**
 * В этом файле описаны типы значений записей каталога (values)
 * 
 */

/**Значения записи */
export interface IBpValues {
  [key: string]:
  | BpValueText
  | BpValueNumber
  | BpValueDate

  | BpValueRadiobutton
  | BpValueCheckboxes
  | BpValueDropdown

  | BpValueProgress
  | BpValueStars

  | BpValueContacts
  | BpValueUsers
  | BpValueObjects

  | BpValueFiles
  | any
}

/**Текст */
export type BpValueText = string
/**Число */
export type BpValueNumber = number
/**Дата */
export type BpValueDate = string | null
/**Выбор значения */
export type BpValueRadiobutton = string
/**Чекбоксы */
export type BpValueCheckboxes = string[]
/**Статус */
export type BpValueDropdown = string[]
/**Прогресс */
export type BpValueProgress = number
/**Оценка звездами*/
export type BpValueStars = number


/**Контакт */
export interface IBpValueContact {
  id: string
  contact: string,
  comment: string
}
export type BpValueContacts = IBpValueContact[]

/**Сотрудник */
export interface IBpValueUser {
  id: string
  title: string
  isRemoved: boolean
}
export type BpValueUsers = IBpValueUser[]

/**Связанный объект */
export interface IBpValueObject {
  sectionId: string
  catalogId: string
  recordId: string
  catalogTitle: string,
  catalogicon: string
  recordTitle: string
  recordValues?: IBpValues

  isRemoved: boolean
}
export type BpValueObjects = IBpValueObject[]

/**Файл */
export interface IBpValueFile {
  id: number,
  metadata: null | string //TODO уточнить?
  mimeType: string
  size: number
  title: string
  url: string
}
export type BpValueFiles = IBpValueFile[]
