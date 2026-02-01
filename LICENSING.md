# Licensing

This repository contains both open-source and proprietary components with different licenses.

## Quick Summary

| Directory | License | Usage |
|-----------|---------|-------|
| `/src`, `/examples`, `/docs` | MIT | Free to use, modify, distribute |
| `/apps` | Commercial | Proprietary, requires license |

## Open Source Components (MIT License)

The core `@oneringai/agents` library and supporting files are licensed under the **MIT License**:

- `src/` - Core library source code
- `examples/` - Usage examples
- `docs/` - Documentation
- `tests/` - Test suite
- Root configuration files

**You are free to:**
- Use the library commercially
- Modify and distribute
- Include in proprietary software
- Sublicense

See [LICENSE](./LICENSE) for the full MIT License text.

## Proprietary Components (Commercial License)

The applications in the `apps/` directory are **proprietary software**:

- `apps/hosea/` - Hosea application
- `apps/amos/` - Amos application

These require a commercial license from Everworker AI. See [apps/LICENSE](./apps/LICENSE) for terms.

**For licensing inquiries:** anton@everworker.ai

## Contributing

Contributions to the open-source components (`src/`, `examples/`, `docs/`) are welcome under the MIT License.

We do not accept contributions to the `apps/` directory.

## Third-Party Dependencies

This project uses various open-source dependencies. Each dependency is licensed under its own terms. See `package.json` and `node_modules/*/LICENSE` for details.
