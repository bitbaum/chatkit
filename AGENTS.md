# ChatKit agent instructions

This repository owns shared chat presentation and behavior. Fix common
composer, thread, message, streaming, keyboard, scrolling, attachment,
dictation, accessibility and rendering defects here, add a regression test,
release the package through the verified path, and then update consumers. Do
not repair shared chat behavior with a local fork in an app.

Products own prompts, model routes, conversation persistence, domain tools,
authorization, product-specific labels and theme adapters. Use ChatKit's
documented slots for those differences, and keep provider/model execution in
the owning AI integration package.

Read the README's standard and demo before changing a public contract. Run
`pnpm run verify`, including browser and rendering checks. Do not move or
rewrite published tags.
