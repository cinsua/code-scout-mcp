# Code Scout MCP Server

A Model Context Protocol (MCP) server for code indexing and Tag-based search.

## 🚀 Features

- **Code Indexing**: Fast indexing of TypeScript, JavaScript, and Python codebases
- **Semantic Search**: Advanced search Tag-based
- **File Watching**: Real-time codebase monitoring and updates
- **MCP Protocol**: Full compliance with Model Context Protocol standards
- **Performance Optimized**: Built for speed and efficiency

## 📦 Installation

```bash
npm install @code-scout/mcp-server
```

## 🛠️ Development

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/code-scout-mcp.git
cd code-scout-mcp

# Install dependencies
npm install

# Build the project
npm run build
```

### Development Commands

```bash
# Development mode with hot reload
npm run dev

# Build for production
npm run build:prod

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Format code
npm run format
```

## 🧪 Testing

This project uses Jest for testing with a comprehensive testing strategy:

### Running Tests

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit          # Unit tests (70%)
npm run test:integration    # Integration tests (20%)
npm run test:performance   # Performance tests (10%)

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure

```
tests/
├── unit/                   # Unit tests
├── integration/            # Integration tests
├── performance/           # Performance tests
├── fixtures/              # Test utilities
└── mocks/                 # Test mocks
```

### Coverage Requirements

- **Statements**: 80% minimum
- **Branches**: 80% minimum
- **Functions**: 80% minimum
- **Lines**: 80% minimum

For detailed testing guidelines, see [docs/TESTING.md](./docs/TESTING.md).

## 🔄 CI/CD

[![Test](https://github.com/your-org/code-scout-mcp/actions/workflows/test.yml/badge.svg)](https://github.com/your-org/code-scout-mcp/actions/workflows/test.yml)
[![codecov](https://codecov.io/gh/your-org/code-scout-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/code-scout-mcp)

This project uses GitHub Actions for continuous integration and deployment:

- **Automated Testing**: Runs on every push and pull request
- **Matrix Testing**: Tests on Node.js 18 and 20
- **Quality Gates**: Linting, type checking, and test coverage
- **Coverage Reporting**: Upload to Codecov for tracking

## 📚 Documentation

- [Technical Specifications](./docs/CORE%20-%20technical_specifications.md)
- [Technology Stack](./docs/CORE%20-%20technology_stack.md)
- [Testing Guide](./docs/TESTING.md)
- [Implementation Notes](./docs/IMPL%20-%20*)

## 🗺️ Roadmap

See the [tasks directory](./tasks/) for detailed implementation roadmap:

- [Task 1.1: Project Structure](./tasks/task_roadmap_mvp_1.1.md) ✅
- [Task 1.2: TypeScript Configuration](./tasks/task_roadmap_mvp_1.2.md) ✅
- [Task 1.3: Testing Framework](./tasks/task_roadmap_mvp_1.3.md) ✅
- [Task 1.4: Core Features](./tasks/task_roadmap_mvp_1.4.md) 🚧
- [Task 1.5: Advanced Features](./tasks/task_roadmap_mvp_1.5.md) 📋

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io/) for the protocol specification
- [Tree-sitter](https://tree-sitter.github.io/) for parsing support
- [Jest](https://jestjs.io/) for testing framework
- [TypeScript](https://www.typescriptlang.org/) for type safety

## 📞 Support

For support and questions:

- Create an [Issue](https://github.com/your-org/code-scout-mcp/issues)
- Check the [Documentation](./docs/)
- Review the [Testing Guide](./docs/TESTING.md)

---

**Built with ❤️ by the Code-Scout Team**
