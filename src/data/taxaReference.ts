import catalog from './taxaCatalog.json';

/**
 * Taxa the classifier predicts. Counts, species, marker genes, example sequences and
 * validation metrics come from taxaCatalog.json, generated from the real training data and
 * model by scripts/build_taxa_catalog.py. Only the common names and descriptions are curated.
 */

export interface NamedCount {
  name: string;
  count: number;
}

export interface TaxonValidation {
  support: number;
  precision: number;
  recall: number;
  f1: number;
  confusedWith: NamedCount[];
}

export interface TaxonExample {
  species: string;
  accession: string;
  marker: string;
  sequence: string;
}

export interface TaxonReference {
  classId: number;
  name: string;
  rank: 'Order' | 'Class';
  phylum: string;
  lineage: string[];
  commonName: string;
  description: string;
  exampleSpecies: string[];
  trainingCount: number;
  speciesCount: number;
  genusCount: number;
  topSpecies: NamedCount[];
  markers: NamedCount[];
  sources: Record<string, number>;
  length: { min: number; median: number; mean: number; max: number };
  gcPercent: number;
  example: TaxonExample | null;
  validation?: TaxonValidation;
}

const CURATED: Record<string, { commonName: string; description: string }> = {
  Perciformes: {
    commonName: 'Perch-like fishes',
    description:
      'Traditionally the largest order of ray-finned fishes. In this dataset it is dominated by Antarctic notothenioids (rockcods and icefishes) and sculpins.',
  },
  Salmoniformes: {
    commonName: 'Salmon, trout and chars',
    description:
      'Cold-water fishes, many of them anadromous: they live at sea but spawn in rivers. Training data includes freshwater populations such as brown trout.',
  },
  Clupeiformes: {
    commonName: 'Herrings, sardines and anchovies',
    description: 'Mostly marine schooling forage fishes that are central to pelagic food webs and major fisheries.',
  },
  Gadiformes: {
    commonName: 'Cods, hakes and grenadiers',
    description: 'Predominantly marine, cold-water demersal fishes, from continental shelves to deep slopes.',
  },
  Pleuronectiformes: {
    commonName: 'Flatfishes',
    description:
      'Flounders, soles, halibut and turbot: bottom-dwelling fishes whose adults have both eyes on one side of the head.',
  },
  Decapoda: {
    commonName: 'Crabs, lobsters and shrimps',
    description: 'Ten-legged crustaceans found from intertidal zones to the deep sea; some lineages live in freshwater.',
  },
  Bivalvia: {
    commonName: 'Clams, mussels, oysters and scallops',
    description: 'Molluscs with a two-part hinged shell; most are filter feeders living in or on sediments.',
  },
  Gastropoda: {
    commonName: 'Snails and slugs',
    description:
      'The most species-rich mollusc class. Training data mixes marine snails with freshwater and terrestrial relatives (e.g. springsnails).',
  },
};

export const TAXA_CATALOG = catalog;

export const TAXA_REFERENCE: TaxonReference[] = catalog.classes.map((c) => ({
  ...c,
  rank: c.rank === 'class' ? 'Class' : 'Order',
  phylum: c.lineage[1],
  commonName: CURATED[c.name]?.commonName ?? '',
  description: CURATED[c.name]?.description ?? '',
  exampleSpecies: c.topSpecies.slice(0, 3).map((s) => s.name),
}));

export function findTaxonByName(name: string): TaxonReference | undefined {
  const normalized = name.trim().toLowerCase();
  return TAXA_REFERENCE.find((t) => t.name.toLowerCase() === normalized);
}

const withExamples = TAXA_REFERENCE.filter((t) => t.example);

/** A real COI sequence from the training data (most common species of its class) */
export const EXAMPLE_SINGLE_SEQUENCE =
  (TAXA_REFERENCE.find((t) => t.name === 'Gadiformes') ?? withExamples[0])?.example?.sequence ?? '';

/** Real training sequences from three different classes, labelled with their NCBI accessions */
export const EXAMPLE_BATCH_FASTA = withExamples
  .filter((t) => ['Gadiformes', 'Decapoda', 'Bivalvia'].includes(t.name))
  .map((t) => `>${t.example!.accession} ${t.example!.species}\n${t.example!.sequence}`)
  .join('\n');
