import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from './stores/session'

const routes = [
  { path: '/login', name: 'login', component: () => import('./modules/auth/views/Login.vue') },
  { path: '/register', name: 'register', component: () => import('./modules/auth/views/Register.vue') },
  { path: '/', name: 'root-entry', component: () => import('./modules/misc/views/RootEntry.vue') },
  { path: '/home', name: 'home', component: () => import('./modules/misc/views/Home.vue'), meta: { auth: true } },
  { path: '/timeline', name: 'timeline', component: () => import('./modules/timeline/views/Timeline.vue'), meta: { auth: true } },
  { path: '/moments', name: 'moments', component: () => import('./modules/moment/views/MomentsView.vue'), meta: { auth: true } },
  { path: '/moments/new', name: 'moment-new', component: () => import('./modules/moment/views/MomentEdit.vue'), meta: { auth: true } },
  { path: '/moments/:id/edit', name: 'moment-edit', component: () => import('./modules/moment/views/MomentEdit.vue'), meta: { auth: true } },
  { path: '/map', name: 'map', component: () => import('./modules/moment/views/LoveMapView.vue'), meta: { auth: true } },
  { path: '/letters', name: 'letters', component: () => import('./modules/letter/views/LettersView.vue'), meta: { auth: true } },
  { path: '/letters/write', name: 'letter-write', component: () => import('./modules/letter/views/LetterWrite.vue'), meta: { auth: true } },
  { path: '/letters/:id/edit', name: 'letter-edit', component: () => import('./modules/letter/views/LetterWrite.vue'), meta: { auth: true } },
  { path: '/letters/:id', name: 'letter-read', component: () => import('./modules/letter/views/LetterRead.vue'), meta: { auth: true } },
  { path: '/albums', name: 'albums', component: () => import('./modules/album/views/AlbumsView.vue'), meta: { auth: true } },
  { path: '/albums/new', name: 'album-new', component: () => import('./modules/album/views/AlbumCreate.vue'), meta: { auth: true } },
  { path: '/albums/:id/edit', name: 'album-edit', component: () => import('./modules/album/views/AlbumEdit.vue'), meta: { auth: true } },
  { path: '/albums/:id', name: 'album-detail', component: () => import('./modules/album/views/AlbumDetail.vue'), meta: { auth: true } },
  { path: '/diary-list', name: 'diary-list', component: () => import('./modules/diary/views/DiaryList.vue'), meta: { auth: true } },
  { path: '/wishes', name: 'wishes', component: () => import('./modules/wish/views/WishesView.vue'), meta: { auth: true } },
  { path: '/wishes/new', name: 'wish-new', component: () => import('./modules/wish/views/WishEdit.vue'), meta: { auth: true } },
  { path: '/wishes/:id/edit', name: 'wish-edit', component: () => import('./modules/wish/views/WishEdit.vue'), meta: { auth: true } },
  { path: '/wishes/:id', name: 'wish-read', component: () => import('./modules/wish/views/WishRead.vue'), meta: { auth: true } },
  { path: '/capsules', name: 'capsules', component: () => import('./modules/capsule/views/CapsulesView.vue'), meta: { auth: true } },
  { path: '/capsules/new', name: 'capsule-new', component: () => import('./modules/capsule/views/CapsuleWrite.vue'), meta: { auth: true } },
  { path: '/capsules/:id', name: 'capsule-read', component: () => import('./modules/capsule/views/CapsuleRead.vue'), meta: { auth: true } },
  { path: '/anniversaries', name: 'anniversaries', component: () => import('./modules/anniversary/views/AnniversariesView.vue'), meta: { auth: true } },
  { path: '/anniversaries/new', name: 'anniversary-new', component: () => import('./modules/anniversary/views/AnniversaryEdit.vue'), meta: { auth: true } },
  { path: '/anniversaries/:id/edit', name: 'anniversary-edit', component: () => import('./modules/anniversary/views/AnniversaryEdit.vue'), meta: { auth: true } },
  { path: '/diary', name: 'diary-calendar', component: () => import('./modules/diary/views/DiaryCalendar.vue'), meta: { auth: true } },
  { path: '/settings', name: 'settings', component: () => import('./modules/theme/views/Settings.vue'), meta: { auth: true } },
  { path: '/write/solo', name: 'write-solo', component: () => import('./modules/diary/views/WriteSolo.vue'), meta: { auth: true } },
  { path: '/entry/:id', name: 'entry', component: () => import('./modules/diary/views/EntryView.vue'), meta: { auth: true } },
  { path: '/observatory', name: 'observatory', component: () => import('./modules/observatory/views/Observatory.vue') },
  { path: '/share/:token', name: 'share', component: () => import('./modules/share/views/ShareView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.name === 'root-entry' && isLoggedIn()) return { name: 'home' }
  if (to.meta.auth && !isLoggedIn()) return { name: 'login', query: { redirect: to.fullPath } }
  if ((to.name === 'login' || to.name === 'register') && isLoggedIn()) return { name: 'home' }
})
