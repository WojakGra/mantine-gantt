import path from 'path';
import { generateDeclarations } from 'mantine-docgen-script';

const getComponentPath = (componentPath: string) =>
  path.join(process.cwd(), 'package/src', componentPath);

generateDeclarations({
  componentsPaths: [
    getComponentPath('Gantt/Gantt.tsx'),
    path.join(process.cwd(), 'scripts/docgen-types.tsx'),
  ],
  tsConfigPath: path.join(process.cwd(), 'tsconfig.json'),
  outputPath: path.join(process.cwd(), 'docs'),
  typesReplacement: {
    GanttDependencyType: "'FS' | 'SS' | 'FF' | 'SF'",
  },
});
