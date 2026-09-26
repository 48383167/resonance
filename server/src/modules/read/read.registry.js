// 内容未读模块注册表：唯一政策来源。
// 约定：某个模块里「不是我自己新增的内容」（即作者不是我、且创建时间晚于我上次打开列表的时间）
// 计入未读；情书沿用逐封已读（love_letters.is_read），不走时间水位。
//
// 字段说明：
//   table        业务表名
//   authorColumn 作者列（null 表示作者不在本表，见 viaContents）
//   timeColumn   创建时间列，与 module_reads.last_read_at 同格式（ISO8601 UTC）
//   viaContents  日记专用：entries 本表无作者列，作者取自 entry_contents.user_id
//   perItemRead  情书专用：逐条已读，未读数直接落在 is_read 上，不参与水位比较
//   extraWhere   额外的 SQL 过滤（仅计数用），必须写成不含用户参数的字面条件
//   filter       JS 侧逐条过滤（计数与列表标注共用），返回 false 表示该条不参与未读

export const MODULE_KEYS = [
  'entry',
  'moment',
  'letter',
  'album',
  'wish',
  'capsule',
  'anniversary',
  'food',
  'care',
  'rule',
]

export const MODULE_LABELS = {
  entry: '日记',
  moment: '瞬间',
  letter: '情书',
  album: '相册',
  wish: '心愿',
  capsule: '胶囊',
  anniversary: '纪念日',
  food: '美食',
  care: '档案',
  rule: '规矩',
}

export const MODULES = {
  entry: {
    label: '日记',
    table: 'entries',
    authorColumn: null,
    timeColumn: 'created_at',
    viaContents: true,
  },
  moment: {
    label: '瞬间',
    table: 'moments',
    authorColumn: 'user_id',
    timeColumn: 'created_at',
  },
  letter: {
    label: '情书',
    table: 'love_letters',
    authorColumn: 'sender_id',
    timeColumn: 'created_at',
    perItemRead: true,
  },
  album: {
    label: '相册',
    table: 'albums',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
  },
  wish: {
    label: '心愿',
    table: 'wish_items',
    authorColumn: 'proposer_id',
    timeColumn: 'created_at',
  },
  capsule: {
    label: '胶囊',
    table: 'time_capsules',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
  },
  anniversary: {
    label: '纪念日',
    table: 'anniversaries',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
  },
  food: {
    label: '美食',
    table: 'food_places',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
  },
  care: {
    label: '档案',
    table: 'care_items',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
    // 例假记录由系统按周期生成/归并，弹未读只会添堵
    extraWhere: "category != 'period'",
    filter: (item) => item.category !== 'period',
  },
  rule: {
    label: '规矩',
    table: 'couple_rules',
    authorColumn: 'author_id',
    timeColumn: 'created_at',
  },
}

// 未读水位兜底值：早于一切业务数据的固定时间点
export const EPOCH = '1970-01-01T00:00:00.000Z'

export function isModuleKey(value) {
  return MODULE_KEYS.includes(value)
}
