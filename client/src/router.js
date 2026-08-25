import { createRouter, createWebHistory } from 'vue-router'
import { isLoggedIn } from './stores/session'

const routes = [
  { path: '/login', name: 'login', component: () => import('./views/Login.vue') },
  { path: '/register', name: 'register', component: () => import('./views/Register.vue') },
  { path: '/', redirect: '/home' },
  { path: '/home', name: 'home', component: () => import('./views/Home.vue'), meta: { auth: true } },
  { path: '/timeline', name: 'timeline', component: () => import('./views/Timeline.vue'), meta: { auth: true } },
  { path: '/moments', name: 'moments', component: () => import('./views/MomentsView.vue'), meta: { auth: true } },
  { path: '/moments/new', name: 'moment-new', component: () => import('./views/MomentEdit.vue'), meta: { auth: true } },
  { path: '/moments/:id/edit', name: 'moment-edit', component: () => import('./views/MomentEdit.vue'), meta: { auth: true } },
  { path: '/map', name: 'map', component: () => import('./views/LoveMapView.vue'), meta: { auth: true } },
  { path: '/letters', name: 'letters', component: () => import('./views/LettersView.vue'), meta: { auth: true } },
  { path: '/letters/write', name: 'letter-write', component: () => import('./views/LetterWrite.vue'), meta: { auth: true } },
  { path: '/letters/:id/edit', name: 'letter-edit', component: () => import('./views/LetterWrite.vue'), meta: { auth: true } },
  { path: '/letters/:id', name: 'letter-read', component: () => import('./views/LetterRead.vue'), meta: { auth: true } },
  { path: '/albums', name: 'albums', component: () => import('./views/AlbumsView.vue'), meta: { auth: true } },
  { path: '/albums/new', name: 'album-new', component: () => import('./views/AlbumCreate.vue'), meta: { auth: true } },
  { path: '/albums/:id/edit', name: 'album-edit', component: () => import('./views/AlbumEdit.vue'), meta: { auth: true } },
  { path: '/albums/:id', name: 'album-detail', component: () => import('./views/AlbumDetail.vue'), meta: { auth: true } },
  { path: '/diary-list', name: 'diary-list', component: () => import('./views/DiaryList.vue'), meta: { auth: true } },
  { path: '/wishes', name: 'wishes', component: () => import('./views/WishesView.vue'), meta: { auth: true } },
  { path: '/wishes/new', name: 'wish-new', component: () => import('./views/WishEdit.vue'), meta: { auth: true } },
  { path: '/wishes/:id/edit', name: 'wish-edit', component: () => import('./views/WishEdit.vue'), meta: { auth: true } },
  { path: '/wishes/:id', name: 'wish-read', component: () => import('./views/WishRead.vue'), meta: { auth: true } },
  { path: '/capsules', name: 'capsules', component: () => import('./views/CapsulesView.vue'), meta: { auth: true } },
  { path: '/capsules/new', name: 'capsule-new', component: () => import('./views/CapsuleWrite.vue'), meta: { auth: true } },
  { path: '/capsules/:id', name: 'capsule-read', component: () => import('./views/CapsuleRead.vue'), meta: { auth: true } },
  { path: '/anniversaries', name: 'anniversaries', component: () => import('./views/AnniversariesView.vue'), meta: { auth: true } },
  { path: '/anniversaries/new', name: 'anniversary-new', component: () => import('./views/AnniversaryEdit.vue'), meta: { auth: true } },
  { path: '/anniversaries/:id/edit', name: 'anniversary-edit', component: () => import('./views/AnniversaryEdit.vue'), meta: { auth: true } },
  { path: '/diary', name: 'diary-calendar', component: () => import('./views/DiaryCalendar.vue'), meta: { auth: true } },
  { path: '/settings', name: 'settings', component: () => import('./views/Settings.vue'), meta: { auth: true } },
  { path: '/write/solo', name: 'write-solo', component: () => import('./views/WriteSolo.vue'), meta: { auth: true } },
  { path: '/entry/:id', name: 'entry', component: () => import('./views/EntryView.vue'), meta: { auth: true } },
  { path: '/observatory', name: 'observatory', component: () => import('./views/Observatory.vue') },
  { path: '/share/:token', name: 'share', component: () => import('./views/ShareView.vue') },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  if (to.meta.auth && !isLoggedIn()) return { name: 'login', query: { redirect: to.fullPath } }
  if ((to.name === 'login' || to.name === 'register') && isLoggedIn()) return { name: 'home' }
})
