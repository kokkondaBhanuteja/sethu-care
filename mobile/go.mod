// This is NOT a real Go module and has no Go code. It exists solely so the root Go module's
// `./...` expansion (build, vet, test, lint) does NOT descend into the mobile/ JavaScript
// workspace — some npm packages vendor Go files (e.g. flatted) that are not ours. Go excludes
// nested modules from a parent's `./...`, which cleanly walls off the whole subtree.
module sethu-care-mobile-ignore

go 1.26
