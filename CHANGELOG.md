# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial `expo-storekit-testing-plugin` implementation.
- Validation for project-relative `.storekit` catalogs and shared scheme names.
- Content-aware catalog copying to a fixed native iOS destination.
- Structured, idempotent StoreKit configuration of the Xcode Run scheme.
- A single Xcode `StoreKit` group and catalog reference without target membership or a Copy Bundle Resources entry.
- TypeScript declarations, automated tests, an Expo example app, packaging checks, and CI coverage for Expo SDK 54 through 57.
