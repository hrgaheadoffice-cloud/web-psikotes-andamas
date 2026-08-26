import React from 'react';
import SectionTitle from './SectionTitle';
import DiscDonutChart from './charts/DiscDonutChart';
import TemperamentDonutChart from './charts/TemperamentDonutChart';
import IQCfitBarChart from './charts/IQCfitBarChart';
import IQWptBarChart from './charts/IQWptBarChart';

const PersonalityAnalytics = ({ filters }) => {
  return (
    <div className="mt-8">
      <SectionTitle
        title="Personality Analytics"
        subtitle="Personality assessment overview"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
        <DiscDonutChart filters={filters} />
        <TemperamentDonutChart filters={filters} />
        <IQCfitBarChart filters={filters} />
        <IQWptBarChart filters={filters} />
      </div>
    </div>
  );
};

export default PersonalityAnalytics;