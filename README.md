# bp-api
small library for work with bpium api

# Simple usage

## Installation
`npm i bp-api --save`


**Get all records by filter**

```js
const BP = require('bp-api')
const bp = new BP(your_domen, your_login, your_password, protocol (https - default value), timeout(30000 default value))

const records = await bp.getAllRecords(catalogId, {
  filters: [
    {
      fieldId: 2,
      value: [1]
    }
  ]
})
```

##Patch record##

```js
await bp.patchRecord(catalogId, records[0].id, {
  3: [{catalogId:2, recordId: 3}]
})
```

# [params filters and methods](https://silent-lad.github.io/Vue2BaremetricsCalendar/#/](https://docs.bpium.ru/integrations/api/data/records))