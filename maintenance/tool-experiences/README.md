# Tool experience sources

Live outputs: tools/{uniform,best11,balance-game}/index.html and tools/experience.{js,css}.
The daily builder in the project root uses tool-pages/*.html overrides before its generic page template.
Edit project-root tool-pages/generate.py and shared assets, run it, then review the three outputs.
finish-tool-experiences.py synchronizes this source archive and checks the builder override output.
The archived generator is reference source; run the project-root copy for daily build synchronization.
