import GenderPieChart from './charts/GenderPieChart';
import AgeBarChart from './charts/AgeBarChart';
import EducationBarChart from './charts/EducationBarChart';
import DepartmentHorizontalBarChart from './charts/DepartmentHorizontalBarChart';
import PositionBarChart from './charts/PositionBarChart';
import BusinessUnitDonutChart from './charts/BusinessUnitDonutChart';

export function StatisticCharts({ filters }) {
    return (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <GenderPieChart filters={filters} />
            <AgeBarChart filters={filters} />
            <EducationBarChart filters={filters} />
            <DepartmentHorizontalBarChart filters={filters} />
            <PositionBarChart filters={filters} />
            <BusinessUnitDonutChart filters={filters} />
        </div>
    );
}
