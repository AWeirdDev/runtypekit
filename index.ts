// The RunType Machine
//
// [ BYTE CODE ] [ PROGRAM COUNTER ] [ REGISTER ] [ RETURN ADDRESS ]
//
// REGISTER        TYPE        DESCRIPTION
// ---------------------------------------------------------------
// $pc             number      Program counter.
// $trg            any         The target item we're looking at.
//
// Dollar signs are used for the sake of JavaScript.
//
//
// INSTRUCTION     DESCRIPTION
// ----------------------------------------------------------------------------
// lofd <f>        Load the field `f` for this object to $trg
// unwd 0          Unwinds to the previous $trg
// tpof <typ>      Check if $trg is of type `typ`
// isin <typ>      Check if $trg is an instance of type `typ`
// steq <itm>      Strict equal (`===`) checks if $trg is `item`
// call <fn>       Calls an external test function `fn`
// test <ref>      Saves the current position, runs another test function
// frtn <res>      Forces an early return, giving `res`
// back 0          Goes back to the previous instructions after testing

declare const phantomField: unique symbol;

const INLINE_THRESHOLD: number = 20;

/**
 * An opaque type. It serves no purpose at runtime.
 */
type opaque = { [phantomField]: opaque };

/**
 * Represents a reference to `T`.
 *
 * This is only for the sake of clarity. It serves no purpose at runtime.
 */
type Ref<T> = T;

/**
 * Generated instructions. The type is set to `opaque` for it is
 * too complicated to express directly in TypeScript.
 *
 * # Format
 * - `index % 2 === 0`: guaranteed to be an instruction (`number`)
 * - `index % 2 === 1`: guaranteed to be a parameter for the instruction (`any`)
 *
 * ```
 * [instruction, param, instruction, param, ...]
 * ```
 */
export type Instructions = opaque[];

enum Inst {
    lofd = 0,
    unwd,
    tpof,
    isin,
    steq,
    call,
    test,
    back,
    frtn,
}

interface Machine {
    stack__trg: any[];
    stack__ret: [Ref<Instructions>, number][]; // TODO: optimization

    $pc: number;
    $trg: any;
}

function machine(code: Instructions, target: any): boolean {
    if ((code[code.length - 2] as any) !== Inst.back) {
        throw new Error("last instruction should always be `back 0`");
    }

    code = code.slice(0, -2);

    const machine = <Machine>{
        // stacks
        stack__trg: [],
        stack__ret: [],

        // registers
        $pc: 0,
        $trg: target,
        $res: false,
    };

    outer: while (machine.$pc < code.length) {
        const instruction = code[machine.$pc] as unknown as Inst;
        const param = code[machine.$pc + 1] as any;

        // console.log(Inst[instruction], param);

        // For the sake of compile-time optimizations, instead of
        // functions (which may have a bit of an overhead), we'll
        // use a switch statement. Compilers like V8 should be
        // able to catch this and create a jump table (best case
        // scenario, however).
        switch (instruction) {
            case Inst.lofd: {
                machine.stack__trg.push(machine.$trg);
                machine.$trg = machine.$trg[param];
                break;
            }

            case Inst.unwd: {
                machine.$trg = machine.stack__trg.pop();
                break;
            }

            case Inst.tpof: {
                if (typeof machine.$trg !== param) return false;
                break;
            }

            case Inst.isin: {
                if (!(machine.$trg instanceof param)) return false;
                break;
            }

            case Inst.steq: {
                if (machine.$trg !== param) return false;
                break;
            }

            case Inst.call: {
                if (!param(machine.$trg)) return false;
                break;
            }

            case Inst.test: {
                machine.stack__ret.push([code, machine.$pc]);
                code = param;
                machine.$pc = 0;
                continue outer;
                break; // unreachable (some language servers don't understand the above)
            }

            case Inst.back: {
                // NOTE: there **MUST** be returns on the stack
                //       if not, it's the dev's fault lol
                const [prevCode, pc] = machine.stack__ret.pop()!;
                code = prevCode;
                machine.$pc = pc;
                break;
            }

            case Inst.frtn: {
                return Boolean(param);
            }

            default: {
                throw new Error(
                    `unknown instruction ${code} at $pc=${machine.$pc}`,
                );
            }
        }

        machine.$pc += 2;
    }

    return true;
}

export interface RunType<T> {
    [phantomField]: T;
    code: Instructions;

    /**
     * Validate `x` to check if it satisfies this type definition.
     *
     * @param x The item to check on.
     */
    validate(x: any): boolean;
}

const RUNTYPE_PROTO = <RunType<any>>{
    validate(x: any): boolean {
        return machine(this.code, x);
    },
};

export function object<F extends { [_ in string]: RunType<unknown> }>(
    fields: F,
): RunType<{
    [K in keyof F]: F[K] extends { [phantomField]: infer P } ? P : never;
}> {
    const instructions: any[] = [Inst.tpof, "object"];

    Object.entries(fields).forEach(([key, runtype]) => {
        instructions.push(Inst.lofd, key);
        if (runtype.code.length - 2 > INLINE_THRESHOLD) {
            instructions.push(Inst.test, runtype.code);
        } else {
            // NOTE: since we're inlining, always remember to
            //       eliminate the additional `back void 0`
            instructions.push(...runtype.code.slice(0, -2));
        }
        instructions.push(Inst.unwd, void 0);
    });

    instructions.push(Inst.back, void 0);
    return Object.setPrototypeOf(
        {
            // [phantomField]: phantomValue,
            code: instructions,
        } as any,
        RUNTYPE_PROTO,
    );
}

export function string<P extends string>(strictEqualTo?: P): RunType<P> {
    const instructions: any[] = [Inst.tpof, "string"];
    if (typeof strictEqualTo !== "undefined") {
        instructions.push(Inst.steq, strictEqualTo);
    }
    instructions.push(Inst.back, void 0);
    return Object.setPrototypeOf(
        {
            code: instructions,
        } as any,
        RUNTYPE_PROTO,
    );
}

export type infer<RT extends RunType<any>> = RT extends {
    [phantomField]: infer T;
}
    ? T
    : never;

// const Person = object({ name: string() });
// console.log(Person.validate({ name: "hello, world" }));
