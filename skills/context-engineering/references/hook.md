# Hook handlers

A hook runs at a harness event when it is registered, enabled and trusted as required by the client. Read the target client's reference from `SKILL.md` for registration and the event contract.

| Need | Handler behavior |
|---|---|
| Ignore unrelated events | Exit successfully without output |
| Match a tool command | Parse the JSON payload and filter inside the handler |
| Add instructions | Return the event's supported context output |
| Block an operation | Use the event's supported blocking response |

Parse JSON with `jq`; matching raw payload text can select the wrong field. A shared handler accepts the inputs both clients actually send, and ignores unrelated calls even when a client applies an additional registration filter.

Keep timeouts bounded. Name skills in emitted prose without a hard-coded client namespace. Hook compatibility variables do not imply the same variables exist in skill bodies.

Exercise the relevant input and an unrelated input in both clients. Check the result at the event boundary as well as by running the script: valid handler output does not prove that registration caused it to run.
