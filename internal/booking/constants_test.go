package booking_test

import (
	"go/ast"
	"go/parser"
	"go/token"
	"testing"

	"github.com/kokkondaBhanuteja/sethu-care/internal/booking"
)

// AllStates() and AllActions() are hand-maintained slices, and everything downstream
// trusts them: the exhaustive 169-combination test iterates them, and the database CHECK
// constraint is generated from them.
//
// That makes them a drift hazard. The `exhaustive` linter forces you to handle a new
// State in every SWITCH — but it says nothing about a hand-written SLICE. So you could
// add StatePaused, satisfy the linter by fixing Valid() and IsTerminal(), and still leave
// AllStates() incomplete. The 169-combination test would then silently never test the new
// state, and the CHECK constraint would silently omit it. The build stays green and the
// guarantee is gone.
//
// This test closes that hole: it PARSES state.go, reads the State and Action constants
// straight out of the source, and asserts the slices contain exactly those. Now the
// constants themselves are the single source of truth, and there is nowhere to drift to.
//
// GO LESSON — go/parser and go/ast are in the standard library, and reading your own
// source is an ordinary thing to do in Go. This is how tools like stringer work. It is
// the closest we get to the reflection over enum values that Java gave us for free.
func TestAllStatesAndAllActionsMatchTheConstantsInSource(t *testing.T) {
	t.Parallel()

	states, actions := parseConstants(t)

	assertSameSet(t, "AllStates()", toStrings(booking.AllStates()), states)
	assertSameSet(t, "AllActions()", toStrings(booking.AllActions()), actions)
}

// parseConstants reads state.go and returns the string VALUES of every constant declared
// with type State and type Action.
func parseConstants(t *testing.T) (states, actions []string) {
	t.Helper()

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "state.go", nil, 0)
	if err != nil {
		t.Fatalf("parsing state.go: %v", err)
	}

	for _, decl := range file.Decls {
		genDecl, ok := decl.(*ast.GenDecl)
		if !ok || genDecl.Tok != token.CONST {
			continue
		}

		for _, spec := range genDecl.Specs {
			valueSpec, ok := spec.(*ast.ValueSpec)
			if !ok || valueSpec.Type == nil || len(valueSpec.Values) == 0 {
				continue
			}
			typeName, ok := valueSpec.Type.(*ast.Ident)
			if !ok {
				continue
			}
			lit, ok := valueSpec.Values[0].(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				continue
			}

			value := lit.Value[1 : len(lit.Value)-1] // strip the surrounding quotes

			switch typeName.Name {
			case "State":
				states = append(states, value)
			case "Action":
				actions = append(actions, value)
			}
		}
	}

	if len(states) == 0 || len(actions) == 0 {
		t.Fatal("parsed no constants from state.go — the parser is broken, not the code")
	}
	return states, actions
}

func assertSameSet(t *testing.T, what string, got, want []string) {
	t.Helper()

	inGot := make(map[string]bool, len(got))
	for _, value := range got {
		inGot[value] = true
	}
	inWant := make(map[string]bool, len(want))
	for _, value := range want {
		inWant[value] = true
	}

	for _, value := range want {
		if !inGot[value] {
			t.Errorf("%s is MISSING %q — it is declared as a constant but never listed, "+
				"so nothing downstream will ever test or persist it", what, value)
		}
	}
	for _, value := range got {
		if !inWant[value] {
			t.Errorf("%s contains %q, which is not declared as a constant in state.go", what, value)
		}
	}
}

// GO LESSON — generics. `[T ~string]` means "any type whose UNDERLYING type is string",
// which is exactly State and Action. The tilde is the whole point: without it, the
// constraint would only match `string` itself and our defined types would not satisfy it.
func toStrings[T ~string](values []T) []string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		out = append(out, string(value))
	}
	return out
}
