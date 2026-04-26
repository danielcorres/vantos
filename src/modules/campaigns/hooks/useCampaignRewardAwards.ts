import { useState, useEffect, useCallback } from 'react'
import { fetchRewardAwards, updateRewardAwardStatus, selectReward } from '../data/campaigns.api'
import type { CampaignRewardAward, AwardStatus } from '../domain/types'

interface Filters {
  periodo?: string
  campaignId?: string
  status?: string
}

interface UseCampaignRewardAwardsResult {
  awards: CampaignRewardAward[]
  loading: boolean
  error: string | null
  reload: () => void
  changeStatus: (awardId: string, newStatus: AwardStatus, notes?: string) => Promise<void>
  chooseReward: (awardId: string, rewardId: string) => Promise<void>
}

export function useCampaignRewardAwards(
  filters?: Filters
): UseCampaignRewardAwardsResult {
  const [awards, setAwards] = useState<CampaignRewardAward[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const filterKey = JSON.stringify(filters)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRewardAwards(filters)
      setAwards(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar premios')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey])

  useEffect(() => {
    void load()
  }, [load])

  const changeStatus = async (
    awardId: string,
    newStatus: AwardStatus,
    notes?: string
  ): Promise<void> => {
    const result = await updateRewardAwardStatus(awardId, newStatus, notes)
    if (!result.ok) throw new Error(result.error ?? 'No se pudo cambiar el status')
    setAwards(prev =>
      prev.map(a =>
        a.id === awardId
          ? { ...a, status: newStatus, status_changed_at: new Date().toISOString() }
          : a
      )
    )
  }

  const chooseReward = async (awardId: string, rewardId: string): Promise<void> => {
    await selectReward(awardId, rewardId)
    setAwards(prev =>
      prev.map(a => (a.id === awardId ? { ...a, selected_reward_id: rewardId } : a))
    )
  }

  return { awards, loading, error, reload: load, changeStatus, chooseReward }
}
