import SpeedBarChart from './charts/SpeedBarChart';
import MemoryDonutChart from './charts/MemoryDonutChart';
import CbiRiskDistribution from './charts/CbiRiskDistribution';
import PapikostickBarChart from './charts/PapikostickBarChart';

export default function RecruitmentAnalytics({ filters }) {
  return <div className="grid grid-cols-1 gap-5 xl:grid-cols-4"><SpeedBarChart filters={filters} /><MemoryDonutChart filters={filters} /><CbiRiskDistribution filters={filters} /><PapikostickBarChart filters={filters} /></div>;
}
