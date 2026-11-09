# ToyShop

ToyShop 是离线优先的跨宿主设计工具箱。当前项目直接基于 AstMatrix 的 `main` 目录初始化，现有条码与二维码编码、渲染、插入和宿主适配代码保留为内建 **AstMatrix** 模块；ToyShop 提供统一模块入口。产品规划见 [PLAN.md](PLAN.md)，原 AstMatrix 使用说明存档于 [docs/ASTMATRIX.md](docs/ASTMATRIX.md)。

## 当前结构

- `packages/core`：内建模块注册与宿主能力声明。
- `packages/modules/astmatrix`：AstMatrix 模块元数据；实现继续使用 `@astmatrix/*` 包。
- `packages/modules/text-case`：Text Case 的 ASCII Latin Safe 纯转换逻辑。
- `packages/toyshop-ui-react`：ToyShop 模块入口及 Text Case 模拟预览。
- `apps/`：Playground、Illustrator CEP、Photoshop UXP 和 Figma Design 入口。
- `tooling/`：沿用 AstMatrix 的兼容构建和打包流程，逐步迁移为 ToyShop。

模块 ID 分别为 `assets.astmatrix` 和 `text.case`。AstMatrix 原有 `@astmatrix/*` 包名暂作内部实现命名，避免在架构初始化时重写成熟编码链。

## 开发

要求 Node.js 24 LTS 与 pnpm 12.11.2。
工作区使用 hoisted 依赖布局，确保 React 与宿主渲染器共享同一实例。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build:figma
pnpm build:illustrator
pnpm build:photoshop
```

浏览器 Playground 和三端 Web 界面均从 ToyShop 模块入口打开，默认显示 AstMatrix。Text Case 页面目前提供纯文本模拟预览；**还不能扫描或修改宿主文档**。Photoshop Native UXP 回退界面目前继续提供 AstMatrix 功能。真实宿主中的文本枚举、富文本保护、预览计划、提交及撤销属于后续 Text Case 集成工作，不能以模拟预览代替验收。

当前 Manifest 使用独立的 ToyShop 开发身份，避免覆盖原 AstMatrix。Figma 数字 ID 与 Illustrator CEP Bundle ID 是开发占位值；正式发布前须替换为各平台分配的身份，并完成真实宿主兼容性测试。现有签名与安装器资产来自 AstMatrix，不能直接作为 ToyShop 发布包。

核心功能保持本地运行；Figma Manifest 禁止网络访问。
