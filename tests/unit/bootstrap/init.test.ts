import { describe, it, expect } from 'vitest';
import { inferEndDates, matchTechKeyword } from '../../../src/bootstrap/init.js';

describe('Bootstrap init helpers & normalization', () => {
  it('infers missing end dates in reverse chronological order', () => {
    const experiences = [
      {
        company: 'Tata 1mg',
        title: 'Lead Software Engineer',
        startDate: 'Apr 2024',
        endDate: 'Present',
      },
      {
        company: 'Tata 1mg',
        title: 'Senior Software Engineer',
        startDate: 'Jan 2022',
        endDate: null,
      },
      {
        company: 'Publicis Sapient',
        title: 'Associate L2 Frontend Engineer',
        startDate: 'Sep 2020',
        endDate: null,
      },
      {
        company: 'USTRAA',
        title: 'Senior Software Developer',
        startDate: 'Mar 2017',
        endDate: null,
      },
    ];

    const inferred = inferEndDates(experiences);

    // Most recent role keeps 'Present'
    expect(inferred[0].company).toBe('Tata 1mg');
    expect(inferred[0].endDate).toBe('Present');

    // 2nd role: before Apr 2024 -> 2024-03
    expect(inferred[1].title).toBe('Senior Software Engineer');
    expect(inferred[1].endDate).toBe('2024-03');

    // 3rd role: before Jan 2022 -> 2021-12
    expect(inferred[2].company).toBe('Publicis Sapient');
    expect(inferred[2].endDate).toBe('2021-12');

    // 4th role: before Sep 2020 -> 2020-08
    expect(inferred[3].company).toBe('USTRAA');
    expect(inferred[3].endDate).toBe('2020-08');
  });

  it('matches tech keywords with word boundaries and special characters', () => {
    expect(matchTechKeyword('Built distributed cache in Go and Redis', 'Go')).toBe(true);
    expect(matchTechKeyword('Ongoing project development', 'Go')).toBe(false);
    expect(matchTechKeyword('Developed backend in Node.js and TypeScript', 'Node.js')).toBe(true);
    expect(matchTechKeyword('Implemented C++ algorithmic solver', 'C++')).toBe(true);
    expect(matchTechKeyword('Optimized SQL queries with PostgreSQL', 'PostgreSQL')).toBe(true);
  });
});
