# runtypekit

A type validator your CPU loves.

```
[ BYTE CODE ] [ PROGRAM COUNTER ] [ REGISTER ] [ RETURN ADDRESS ]
```

## Registers

These are basically virtual.

| Register | Type | Description |
|----------|------|--------------|
| `$pc` | `number` | Program counter. |
| `$trg` | `any` | The target item we're looking at. |

> Dollar signs are used for the sake of JavaScript.

## Instructions

| Instruction | Description |
|-------------|-------------|
| `lofd <f>` | Load the field `f` for this object to `$trg` |
| `unwd 0` | Unwinds to the previous `$trg` |
| `tpof <typ>` | Check if `$trg` is of type `typ` |
| `isin <typ>` | Check if `$trg` is an instance of type `typ` |
| `steq <itm>` | Strict equal (`===`) checks if `$trg` is `item` |
| `call <fn>` | Calls an external test function `fn` |
| `test <ref>` | Saves the current position, runs another test function |
| `frtn <res>` | Forces an early return, giving `res` |
| `back 0` | Goes back to the previous instructions after testing |

## Example
Haha yes funny

```ts
import * as rtk from "runtypekit";

const Person = rtk.object({ name: string() });
type Person = rtk.infer<typeof Person>;

console.log(Person.validate({ name: "awd" }));
```

**Emitted instructions**:

```asm
tpof object
lofd name
tpof string
unwd 0
```

You can see that some instructions are basically inlined because they're really small.
