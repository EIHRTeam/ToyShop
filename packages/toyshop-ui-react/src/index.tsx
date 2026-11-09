import { useState } from 'react';
import type { ComponentType } from 'react';
import { ModuleRegistry } from '@toyshop/core';
import { astmatrixModule } from '@toyshop/module-astmatrix';
import { convertTextCase, textCaseModule } from '@toyshop/module-text-case';
import type { TextCaseOperation } from '@toyshop/module-text-case';

export const toyshopModules = new ModuleRegistry([textCaseModule, astmatrixModule]);

export function ToyshopPanel({ astmatrix: AstMatrixContent }: { astmatrix: ComponentType }) {
  const [moduleId, setModuleId] = useState(astmatrixModule.id);
  const current = toyshopModules.get(moduleId);

  return (
    <div className="toyshop-shell">
      <header className="toyshop-header">
        <div className="toyshop-mark" aria-hidden="true">
          T
        </div>
        <div>
          <h1>ToyShop</h1>
          <p>Design tools</p>
        </div>
      </header>
      <nav className="toyshop-nav" aria-label="工具模块">
        {toyshopModules.list().map((module) => (
          <button
            key={module.id}
            className={moduleId === module.id ? 'toyshop-nav-item active' : 'toyshop-nav-item'}
            aria-current={moduleId === module.id ? 'page' : undefined}
            onClick={() => setModuleId(module.id)}
            type="button"
          >
            <span>{module.name}</span>
            <small>{module.category === 'text' ? 'Text tools' : 'Asset tools'}</small>
          </button>
        ))}
      </nav>
      <section className="toyshop-workspace" aria-label={current?.name ?? '工具工作区'}>
        {moduleId === astmatrixModule.id ? <AstMatrixContent /> : <TextCasePreview />}
      </section>
    </div>
  );
}

function TextCasePreview() {
  const [input, setInput] = useState('Hello Café 世界 WORLD');
  const [operation, setOperation] = useState<TextCaseOperation>('upper');
  const output = convertTextCase(input, operation);

  return (
    <div className="toyshop-text-case">
      <span className="toyshop-kicker">TEXT TOOLS · 模拟预览</span>
      <h2>Text Case Converter</h2>
      <p>按 ASCII Latin Safe 规则转换文字。宿主文档扫描与写回尚未接入。</p>
      <label htmlFor="toyshop-operation">转换方式</label>
      <select
        id="toyshop-operation"
        value={operation}
        onChange={(event) => setOperation(event.target.value as TextCaseOperation)}
      >
        <option value="upper">UPPERCASE</option>
        <option value="lower">lowercase</option>
      </select>
      <label htmlFor="toyshop-input">示例文字</label>
      <textarea
        id="toyshop-input"
        value={input}
        onChange={(event) => setInput(event.target.value)}
      />
      <label htmlFor="toyshop-output">预览结果</label>
      <output id="toyshop-output" className="toyshop-output">
        {output || ' '}
      </output>
      <p className="toyshop-note">ASCII 字符无法判定语言；同样使用 ASCII 的其他语言也会转换。</p>
    </div>
  );
}
