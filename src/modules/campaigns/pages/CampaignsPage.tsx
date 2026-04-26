import { useAuth } from '../../../shared/auth/AuthProvider'
import { AdvisorCampaignsPage } from './AdvisorCampaignsPage'
import { ManagerCampaignsPage } from './ManagerCampaignsPage'
import { AdminCampaignsPage } from './AdminCampaignsPage'

export function CampaignsPage() {
  const { role } = useAuth()

  if (role === 'advisor') return <AdvisorCampaignsPage />
  if (role === 'manager') return <ManagerCampaignsPage />
  return <AdminCampaignsPage />
}
