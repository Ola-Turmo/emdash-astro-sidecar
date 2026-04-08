# EmDash Astro Sidecar Documentation

Welcome to the EmDash Astro Sidecar documentation!

## Overview

EmDash Astro Sidecar is an Astro-native blog engine that provides a complete CMS, content management system, and publishing workflow for existing Astro sites.

## Key Concepts

### Architecture

The monorepo is organized into:

- **apps/blog** - Main Astro blog application with EmDash integration
- **packages/theme-core** - Shared design tokens and UI components
- **packages/design-clone** - Design cloning pipeline
- **packages/skills** - AI-agent skills for Hermes integration
- **packages/plugins** - Plugin SDK for extending functionality

### EmDash Integration

EmDash serves as the CMS layer, providing:
- Content management APIs
- Blog post, author, category, and tag data models
- Publishing workflow
- Query APIs for fetching content

## Getting Started

Follow the [Setup Guide](./setup.md) to get up and running.

## Documentation Sections

- [Setup Guide](./setup.md) - Installation and configuration
- [Deployment](./deployment.md) - Cloudflare Workers/Pages deployment
- [Plugin Development](./plugin-dev.md) - Building plugins
- [Editorial Workflow](./editorial-workflow.md) - Content publishing workflow
