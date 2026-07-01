import { topoSort } from './topo-sort';

// Simulating FORGE's actual module dependencies
const modules = [
  { id: 'auth', dependencies: [] },
  { id: 'db', dependencies: [] },
  { id: 'routes', dependencies: ['auth', 'db'] },
  { id: 'frontend', dependencies: ['routes'] },
];

const waves = topoSort(modules);

console.log('\n🔥 FORGE Execution Plan:');
console.log('========================');
waves.forEach((wave, i) => {
  console.log(`Wave ${i + 1} — runs in parallel: [${wave.join(', ')}]`);
});

console.log('\nExpected:');
console.log('Wave 1 — runs in parallel: [auth, db]');
console.log('Wave 2 — runs in parallel: [routes]');
console.log('Wave 3 — runs in parallel: [frontend]');