export type ModuleCategory = 'text' | 'layers' | 'document' | 'assets';
export type HostCapability =
  | 'document.read'
  | 'document.write'
  | 'selection.read'
  | 'text.enumerate'
  | 'text.read'
  | 'text.write'
  | 'text.richStyles'
  | 'history.transaction'
  | 'document.observe';

export interface ModuleDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly category: ModuleCategory;
  readonly experimental?: boolean;
  readonly requiredCapabilities: readonly HostCapability[];
}

export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();

  constructor(modules: readonly ModuleDefinition[] = []) {
    for (const module of modules) this.register(module);
  }

  register(module: ModuleDefinition): void {
    if (!module.id || this.modules.has(module.id)) {
      throw new Error(`Invalid or duplicate module ID: ${module.id}`);
    }
    this.modules.set(module.id, Object.freeze({ ...module }));
  }

  list(): readonly ModuleDefinition[] {
    return [...this.modules.values()];
  }

  get(id: string): ModuleDefinition | undefined {
    return this.modules.get(id);
  }

  missingCapabilities(id: string, available: ReadonlySet<HostCapability>): HostCapability[] {
    const module = this.get(id);
    if (!module) throw new Error(`Unknown module: ${id}`);
    return module.requiredCapabilities.filter((capability) => !available.has(capability));
  }
}
