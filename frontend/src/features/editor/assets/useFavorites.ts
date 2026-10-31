import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import type { FavoriteCategory, FavoriteRow } from '../types'
import {
  createFavoriteCategory,
  deleteFavorite,
  deleteFavoriteCategory,
  fetchFavorites,
  renameFavoriteCategory,
  updateFavorite,
  type FavoritesResponse,
} from './api'

export const FAVORITES_KEY = ['editor', 'favorites']

/** قيمة «التصنيف» للعناصر اللي من غير تصنيف (في الفلاتر والاختيار). */
export const UNCATEGORIZED = 'none'

/**
 * مكتبة المفضلة (مشتركة بين كل الدعوات والقوالب). الكاش بيفضل ٣٠ دقيقة والقايمة بتظهر منه في نفس اللحظة،
 * وبعد ٣٠ ثانية بتتحدّث في الخلفية من غير ما تختفي — بدل «جارٍ التحميل» في كل مرة.
 */
export const favoritesQuery = () => ({ queryKey: FAVORITES_KEY, queryFn: fetchFavorites, staleTime: 30_000, gcTime: 30 * 60_000 })

export const useFavoritesQuery = () => useQuery(favoritesQuery())

/** يجيب المكتبة قبل ما المستخدم يفتحها (مؤشر فوق الزر/الرابط أو وقت فراغ). */
export const prefetchFavorites = (client: QueryClient) => client.prefetchQuery(favoritesQuery())

/** عدد العناصر في كل تصنيف (‎UNCATEGORIZED‎ لغير المصنّفة). */
export function countByCategory(favorites: FavoriteRow[]): Map<number | typeof UNCATEGORIZED, number> {
  const counts = new Map<number | typeof UNCATEGORIZED, number>()
  for (const favorite of favorites) {
    const key = favorite.categoryId ?? UNCATEGORIZED
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * تعديلات المكتبة (تسمية/نقل/حذف عنصر، وإضافة/تسمية/حذف تصنيف). كل دالة بترمي الخطأ لو السيرفر رفض،
 * وبتحدّث كاش القايمة محلياً بعد النجاح (من غير ما تجيب المئات من الكيلوبايت تاني).
 */
export function useFavoriteActions() {
  const client = useQueryClient()
  const update = (change: (data: FavoritesResponse) => FavoritesResponse) =>
    client.setQueryData<FavoritesResponse>(FAVORITES_KEY, (data) => (data ? change(data) : data))
  const replace = (favorite: FavoriteRow) =>
    update((data) => ({ ...data, favorites: data.favorites.map((f) => (f.id === favorite.id ? { ...f, ...favorite, block: f.block } : f)) }))

  return {
    async rename(favorite: FavoriteRow, name: string) {
      replace((await updateFavorite(favorite.id, { name })).favorite)
    },
    async move(favorite: FavoriteRow, categoryId: number | null) {
      replace((await updateFavorite(favorite.id, { categoryId })).favorite)
    },
    async remove(favorite: FavoriteRow) {
      await deleteFavorite(favorite.id)
      update((data) => ({ ...data, favorites: data.favorites.filter((f) => f.id !== favorite.id) }))
    },
    async addCategory(name: string): Promise<FavoriteCategory> {
      const { category } = await createFavoriteCategory(name)
      update((data) => ({ ...data, categories: [...data.categories, category] }))
      return category
    },
    async renameCategory(category: FavoriteCategory, name: string) {
      const { category: next } = await renameFavoriteCategory(category.id, name)
      update((data) => ({ ...data, categories: data.categories.map((c) => (c.id === next.id ? next : c)) }))
    },
    async removeCategory(category: FavoriteCategory) {
      await deleteFavoriteCategory(category.id)
      update((data) => ({
        categories: data.categories.filter((c) => c.id !== category.id),
        favorites: data.favorites.map((f) => (f.categoryId === category.id ? { ...f, categoryId: null } : f)),
      }))
    },
    invalidate: () => client.invalidateQueries({ queryKey: FAVORITES_KEY }),
  }
}
