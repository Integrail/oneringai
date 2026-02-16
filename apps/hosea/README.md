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

![Agent Creation](docs/images/03agents.png)

2. Select tools you want to make available to the agent. Tools are where the main POWER of your agents come from, but be careful not to give too many (vendors recommend giving not more than a 100, but be mindful of your context tokens). Also, some tools are EXTREMELY POWERFUL so you need to excercise caution if you are using them - e.g., `bash` tool basically allows to run ANY terminal command on your system, so it is **YOUR RESPONSIBILITY** to introduce guardrails, prompt limitations, and monitor what your agents are doing to avoid damaging your files and systems!

![Agents Tools](docs/images/04agents.png)

**!NB** Be sure to study which tools we have - there are a bunch coming out of box, a lot are enabled depending on the connectors you have configured and you can also add your own via the `oneringai` library itself. However, be mindful that different sets of tools are for different purposes, e.g. Browser tools implement actual in-UI browser automation but mixing them with API-based tools might not be the best idea. Having said that, feel free to experiment!

3. Finally, setup the **Context Plugins**. Our agents use a very sophisticated smart context management system that is fully pluggable and extendable (again, see `oneringai` documentation), providing 3 key plugins out of box:

 - **Working Memory**: allows agents to keep large pieces of information *outside* of the context with ability to easily retrieve when relevant via key-value-pair index in context. This comes extremely handy when an agent executes a lot of tool calls that return large amounts of information.

 - **In Context Memory**: similar to working memory, but keeps key-value based information right in the context. The power of this plugin comes from the fact that this allows you to implement plan / task execution agents, agents that work with constantly updating "artefact" that lives in the context without the issue of "sliding window" disappearing message history etc. See also prompt templates.

 - **Persistent Instructions**: this provides *updateable* instructions that get included into system prompt automatically, but the agent can manipulate them directly via special built-in tools. This basically allows you to implement *self-learning* -- the agent can update its own instructions on the fly following your requests or by its own! Experiment!

![Agents Context](docs/images/05agents.png)

## License

See LICENSE file in the same folder
