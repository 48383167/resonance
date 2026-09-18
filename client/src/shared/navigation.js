export const navigationItems = [
  { name: 'home', route: 'home', label: '首页', icon: '⌂', group: '日常', activeRoutes: ['home'] },
  { name: 'timeline', route: 'timeline', label: '时间轴', icon: '◷', group: '回忆', activeRoutes: ['timeline'] },
  {
    name: 'diary-list',
    route: 'diary-list',
    label: '日记',
    icon: '▤',
    group: '记录',
    activeRoutes: ['diary-list', 'diary-calendar', 'entry', 'entry-edit'],
  },
  {
    name: 'moments',
    route: 'moments',
    label: '瞬间',
    icon: '✦',
    group: '记录',
    activeRoutes: ['moments', 'moment-new', 'moment-edit'],
  },
  {
    name: 'letters',
    route: 'letters',
    label: '情书',
    icon: '✉',
    group: '连接',
    activeRoutes: ['letters', 'letter-write', 'letter-edit', 'letter-read'],
  },
  { name: 'companion', route: 'companion', label: '心语陪伴', icon: '☾', group: '连接', activeRoutes: ['companion'] },
  { name: 'albums', route: 'albums', label: '相册', icon: '▧', group: '回忆', activeRoutes: ['albums', 'album-new', 'album-edit', 'album-detail'] },
  { name: 'map', route: 'map', label: '地图', icon: '⌖', group: '回忆', activeRoutes: ['map'] },
  { name: 'wishes', route: 'wishes', label: '心愿', icon: '◇', group: '计划', activeRoutes: ['wishes', 'wish-new', 'wish-edit', 'wish-read'] },
  { name: 'notebook', route: 'notebook', label: '小本本', icon: '✎', group: '日常', activeRoutes: ['notebook', 'care-new', 'care-edit', 'rule-new', 'rule-edit', 'rule-detail', 'rule-agree'] },
  { name: 'capsules', route: 'capsules', label: '胶囊', icon: '◌', group: '计划', activeRoutes: ['capsules', 'capsule-new', 'capsule-read'] },
  {
    name: 'anniversaries',
    route: 'anniversaries',
    label: '纪念日',
    icon: '◆',
    group: '计划',
    activeRoutes: ['anniversaries', 'anniversary-new', 'anniversary-edit'],
  },
  { name: 'observatory', route: 'observatory', label: '观测台', icon: '◎', group: '其他', activeRoutes: ['observatory'] },
  { name: 'settings', route: 'settings', label: '设置', icon: '⚙', group: '其他', activeRoutes: ['settings'] },
]

// 情感陪伴是高频、私有的全局入口；情书仍可在“更多功能”和首页进入。
export const primaryNavigationNames = ['home', 'timeline', 'diary-list', 'companion']

export const navigationGroups = ['日常', '记录', '连接', '回忆', '计划', '其他'].map((label) => ({
  label,
  items: navigationItems.filter((item) => item.group === label),
}))
