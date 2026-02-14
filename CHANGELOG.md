# Changelog

All notable changes to this project will be documented in this file.
## [0.1.1] - 2026-02-14

### 🐛 Bug Fixes

- *(port-layer)* Avoid left-edge stream residue
- *(port-layer)* Clear stream state for removed ports

### 🚜 Refactor

- *(logging)* Migrate rust logs to tracing

### 📚 Documentation

- *(readme)* Add project setup and usage guide
- *(readme)* Simplify to release usage and constraints
- *(readme)* Add GitHub download command for release

### 🧪 Testing

- *(e2e)* Add port delete stream residue check
- *(e2e)* Wait for firewall drop modal details
## [0.1.0] - 2026-02-13

### 🚀 Features

- *(ui)* Implement packet capture visualizer UI components
- *(ui)* Implement mailbox-style packet visualization
- *(animation)* Add stream mode for high packet volume
- *(animation)* Add drop stream mode for high packet volume
- *(packet)* Add protocol-port mapping logic
- *(packetStore)* Add error state for capture operations
- *(error)* Add Error Boundary and error display UI
- *(animation)* Apply stream mode to NetworkLayer bottom animation
- *(dev)* Add mock packet generator for non-Tauri development
- *(header)* Split packet counter into delivered and dropped counts
- *(port)* Add user-customizable port configuration
- *(port)* Add drag-and-drop reorder and throw-to-delete for mailboxes
- *(port)* Auto-assign random unused port on Add
- *(port)* Enable single-click editing and remove grab cursor
- *(port)* Reduce default ports to single entry
- *(capture)* Add eBPF/XDP packet capture backend
- *(capture)* Add kfree_skb tracepoint for packet drop detection
- *(capture)* Resolve drop reason names from BTF at runtime
- *(ui)* Redesign NIC layer with single post and expandable interface selector
- *(server)* Add axum web server with REST API and WebSocket
- *(ui)* Add transport layer for Tauri/Web dual support
- *(capture)* Add permission check at startup for eBPF mode
- *(web)* Add data-testid attributes and fix Escape key modal close
- *(drop)* Add click modal and improve tooltip for DroppedPile
- *(mock)* Add API to dynamically configure mock capture settings
- *(perf)* Add frontend performance measurement tools
- *(mock)* Add batchSize parameter for stress testing
- *(perf)* Add frontend stress test with graduated load levels
- *(ui)* Add horizontal scroll to PortLayer with fade indicators
- *(ui)* Align packet animations to device center instead of zone center
- *(ui)* Replace default branding with mailbox-themed favicon and title
- *(ui)* Add timestamp to modal packet items

### 🐛 Bug Fixes

- *(animation)* Improve packet animation timing and positioning
- *(ui)* Fix dropped packet animation position and layout shift
- *(ui)* Fix dropped packet animation position and layout shift
- *(capture)* Improve reset and start/stop button behavior
- *(PortLayer)* Fix memory leak and optimize array comparison
- *(stream)* Remove packet filter on stream mode transition in PortLayer
- *(stream)* Disable pile transition during drop stream mode
- *(port)* Align Other mailbox label by adding em dash placeholder
- *(counter)* Use cumulative counters instead of array length for packet badges
- *(counter)* Use port number as key instead of array index for per-port data
- *(port)* Activate mailbox in stream mode by checking streamingPorts
- *(port)* Unify box model between p and input in EditableLabel
- *(port)* Prevent full-select on each keystroke during port number editing
- *(packet)* Lower animation endpoint by 10px
- *(ui)* Prevent background scroll when modal is open
- *(capture)* Make NIC attach idempotent and preserve state on reload
- *(tauri)* Abort bridge task on capture restart to prevent leak
- *(capture)* Correct BTF kind numbers in drop reason parser
- *(server)* Return structured JSON error responses from API
- *(web)* Improve transport error handling and reconnection
- *(mock)* Track attached interfaces and gate packet generation
- *(e2e)* Resolve test flakiness from shared backend state
- *(port)* Defer store update until edit commit
- *(transport)* Prevent listener leak on early cleanup in Tauri transport
- *(server)* Return appropriate HTTP status codes from API error responses
- *(drop)* Dynamically position tooltip within viewport bounds
- *(perf)* Auto-start mock server for Lighthouse measurement
- *(test)* Exclude perf dir from vitest
- *(ui)* Prevent drop animation from intercepting pile click events
- *(ui)* Reset drag flag on drag end to fix right-swap click
- *(ui)* Hide tooltip when drop packet modal is open
- *(ui)* Replace CPU icon with Plug icon for NIC device
- *(e2e)* Add stream-transitions dependency to nic-attach project

### 💼 Other

- Add vitest coverage provider

### 🚜 Refactor

- Extract constants, hooks, and unify components
- *(events)* Consolidate packet events into single captured event
- *(react)* Remove useEffect in favor of React 19 patterns
- *(react)* Apply React 19 patterns and add React Compiler
- *(animation)* Migrate to Framer Motion
- Remove unused id prop from animation components
- *(App)* Remove unnecessary function wrappers
- *(packet)* Separate L4/L7 protocols and centralize port config
- *(animation)* Use centralized duration constants
- *(stream)* Change stream mode detection from buffer-count to rate-based
- *(stream)* Redesign to per-layer independent chain with CSS animations
- *(stream)* Replace StreamPhase with boolean + UI fade-out
- *(react)* Replace useEffect with better patterns
- *(ebpf)* Support multi-interface XDP attach
- *(ebpf)* Rewrite eBPF programs in C using clang
- *(ebpf)* Support dynamic XDP attach/detach via command channel
- *(capture)* Extract capture logic into scrop-capture lib crate
- *(port)* Extract DraggableMailbox and usePortPositionStore from PortLayer
- Remove dead code from legacy UI components

### 📚 Documentation

- Update React version in CLAUDE.md
- Add test commands to CLAUDE.md
- Add E2E_PORT usage to test commands
- *(changelog)* Add v0.1.0 release notes

### ⚡ Performance

- *(store)* Batch emitChange calls during stream mode processing
- *(frontend)* Fine-grained store subscriptions per component
- *(ui)* Virtualize modal packet lists with @tanstack/react-virtual
- *(ui)* Per-port store subscriptions and animation zone separation
- *(store)* Reduce delivered flush rate to 500ms and fix buffer overflow
- *(ui)* Optimize Mailbox with memo and per-port subscriptions

### 🎨 Styling

- *(ui)* Add spacing between packet list modal items

### 🧪 Testing

- Add frontend and backend test suites with coverage
- *(e2e)* Add Playwright E2E test suite
- *(e2e)* Add modal scroll lock test
- Add interface-aware capture tests
- *(e2e)* Add port layer drag-and-drop tests
- *(e2e)* Add data-testid attributes for E2E testing
- *(e2e)* Add port edit, dropped packets, and realtime feature tests
- *(drop)* Add E2E tests for tooltip viewport containment
- *(e2e)* Add animation E2E tests

### ⚙️ Miscellaneous Tasks

- Add git-cliff config and update gitignore
- Add Cargo.lock for reproducible builds
- Remove unused preview script
- Add test reports and build artifacts to .gitignore
