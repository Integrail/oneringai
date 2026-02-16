# HOSEA by Everworker.ai

**Human-Oriented System for Engaging Agents**

A desktop application for interacting with AI agents and generative AI in general powered by the `@everworker/oneringai` library. "Swiss Army Knife" of AI!

## Features

- **Multi-vendor support** - Connect to OpenAI, Anthropic, Google, and more
- **Real-time streaming** - See responses as they're generated
- **Session management** - Save and resume conversations
- **Tool integration** - Enable/disable agent tools, with auto-tools provided by connectors
- **Universal Connector** - system to connect to ANY vendor that has an API, with 40+ templates and more coming
- **Multimedia Studio** - generate images, videos, speech, etc - depending on the connectors you added
- **Native experience** - Electron-based desktop app for macOS, Windows, Linux
- **And much, much more!**

## Installation

For developers, simply clone the `oneringai` repo, then `cd apps/hosea` and then `npm install` and `npm run dev` - that's it, you are set!

For non-developers, [go to releases](https://github.com/Integrail/oneringai/releases/), find your platform's installer and follow the usual steps.

### Note for Mac users
If you are using an installer, you may get "an untrusted developer" notice or something. This is Apple's fault as they are extremely slow in processing the so-called "notarization requests", but usually you just need to right click on the app once you installed it and then "open", and then allow it to run. In some cases it may forbid running it altogether, then you have to go to "System Settings", "Privacy and Security", and change the corresponding setting. Once you go through it once, the updates are automatic!

## Initial Setup

!IMPORTANT! There will ALWAYS be a FREE version of Hosea, but it requires you to bring your own keys to all the providers you want to use. Very soon we will introduce a proxied but paid version, where you get ALL functionality out of box, but we plan to charge for it a small fee to cover our expenses.

Normally, after first run the system should ask you to configure your first LLM provider. If it doesn't or if you want to have more than one provider (which we definitely recommend, especially if you want multimedia capabilities) - go to "LLM Providers" tab and simply add a new one!

 ![LLMs configuration](docs/images/01llms.png)

 Optionally, configure Universal Connectors as well - we recommend at least something to provide you web search and web scrape, without them research tools would be somewhat limited. Serp and Zenrows are good defaults for this.

 Then, proceed to creating agents and create as many as you like:
 
 ![Agents page](docs/images/02agents.png)

 1. Fill in the basic info, by selecting a connector, model, name and system instructions (see the section below for good system prompt examples that fully utilize our smart-context management system for agents)

![Agents page](docs/images/03agents.png)


## License

See LICENSE file in the same folder
