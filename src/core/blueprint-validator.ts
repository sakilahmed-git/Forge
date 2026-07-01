import { Blueprint, ModuleId } from '../types/blueprint';
import { validateNoCycles } from '../utils/topo-sort';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateBlueprint(blueprint: Blueprint): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!isNonEmptyString(blueprint.id)) {
    errors.push('blueprint.id must be a non-empty string');
  }

  if (!isNonEmptyString(blueprint.userPrompt)) {
    errors.push('blueprint.userPrompt must be a non-empty string');
  }

  if (!Array.isArray(blueprint.modules) || blueprint.modules.length === 0) {
    errors.push('blueprint.modules must be a non-empty array');
  }

  const moduleIds = new Set<ModuleId>();
  const exportNames = new Set<string>();

  if (Array.isArray(blueprint.modules)) {
    blueprint.modules.forEach((module, moduleIndex) => {
      if (!isNonEmptyString(module.id)) {
        errors.push(`module at index ${moduleIndex} must have a non-empty id`);
      } else {
        moduleIds.add(module.id);
      }

      if (!isNonEmptyString(module.ownerAgent)) {
        errors.push(`module ${module.id || moduleIndex} must have a non-empty ownerAgent`);
      }

      if (!Array.isArray(module.files)) {
        errors.push(`module ${module.id || moduleIndex} files must be an array`);
      }

      if (!Array.isArray(module.exports)) {
        errors.push(`module ${module.id || moduleIndex} exports must be an array`);
      }

      if (!Array.isArray(module.acceptanceCriteria)) {
        errors.push(`module ${module.id || moduleIndex} acceptanceCriteria must be an array`);
      } else if (module.acceptanceCriteria.length < 3) {
        errors.push(`module ${module.id || moduleIndex} acceptanceCriteria must have at least 3 items`);
      }

      if (Array.isArray(module.exports)) {
        module.exports.forEach((exportDefinition, exportIndex) => {
          if (!isNonEmptyString(exportDefinition.name)) {
            errors.push(`module ${module.id || moduleIndex} export ${exportIndex} must have a non-empty name`);
          } else if (exportNames.has(exportDefinition.name)) {
            errors.push(`duplicate export name found: ${exportDefinition.name}`);
          } else {
            exportNames.add(exportDefinition.name);
          }

          if (!isNonEmptyString(exportDefinition.filePath)) {
            errors.push(`module ${module.id || moduleIndex} export ${exportIndex} must have a non-empty filePath`);
          }
        });
      }
    });
  }

  if (!Array.isArray(blueprint.executionOrder) || blueprint.executionOrder.length === 0) {
    errors.push('blueprint.executionOrder must be a non-empty array');
  } else {
    blueprint.executionOrder.flat().forEach((moduleId) => {
      if (!moduleIds.has(moduleId)) {
        errors.push(`executionOrder references unknown moduleId: ${moduleId}`);
      }
    });
  }

  if (!Array.isArray(blueprint.envVars)) {
    errors.push('blueprint.envVars must be an array');
  }

  if (!Array.isArray(blueprint.apiContracts)) {
    errors.push('blueprint.apiContracts must be an array');
  }

  if (Array.isArray(blueprint.modules)) {
    const hasNoCycles = validateNoCycles(
      blueprint.modules.map((module) => ({
        id: module.id,
        dependencies: module.dependencies,
      }))
    );

    if (!hasNoCycles) {
      errors.push('blueprint.modules must not contain circular dependencies');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidBlueprint(blueprint: Blueprint): void {
  const result = validateBlueprint(blueprint);

  if (!result.valid) {
    throw new Error(result.errors.join('\n'));
  }
}
