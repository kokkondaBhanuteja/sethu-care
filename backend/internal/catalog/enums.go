// Package catalog owns the HSOS service tree: categories, skills, services, variants and
// the questions asked at booking time. Adding a service is an INSERT, never a deploy.
package catalog

import "fmt"

// AssignmentMode is a property of the SERVICE, not of the system (ROADMAP §4.5).
//
// Repairs are AUTO — the offer engine finds a technician. Product delivery and
// installation are MANUAL — an admin assigns deliberately, because delivering a
// refrigerator involves stock, a vehicle and a staircase. Changing it is an UPDATE.
//
// This is why P3's delivery/installation needs ZERO new dispatch work: an installation is
// simply a job that happens to be assigned by a human, reusing the manual queue built and
// hardened in P1.
type AssignmentMode string

const (
	AssignmentAuto   AssignmentMode = "AUTO"
	AssignmentManual AssignmentMode = "MANUAL"
)

func AllAssignmentModes() []AssignmentMode {
	return []AssignmentMode{AssignmentAuto, AssignmentManual}
}

func (mode AssignmentMode) Valid() bool {
	switch mode {
	case AssignmentAuto, AssignmentManual:
		return true
	}
	return false
}

func (mode AssignmentMode) String() string { return string(mode) }

func ParseAssignmentMode(raw string) (AssignmentMode, error) {
	mode := AssignmentMode(raw)
	if !mode.Valid() {
		return "", fmt.Errorf("catalog: unknown assignment mode %q", raw)
	}
	return mode, nil
}

// QuestionKind is the shape of a dynamic booking question.
//
// This constant existed ONLY as a SQL string literal in the original design — a CHECK
// constraint with no Go type bound to it. That is exactly the orphaned-constant problem
// this package exists to close.
type QuestionKind string

const (
	QuestionText         QuestionKind = "TEXT"
	QuestionSingleChoice QuestionKind = "SINGLE_CHOICE"
	QuestionPhoto        QuestionKind = "PHOTO"
)

func AllQuestionKinds() []QuestionKind {
	return []QuestionKind{QuestionText, QuestionSingleChoice, QuestionPhoto}
}

func (kind QuestionKind) Valid() bool {
	switch kind {
	case QuestionText, QuestionSingleChoice, QuestionPhoto:
		return true
	}
	return false
}

// RequiresOptions reports whether this kind is meaningless without choices to pick from.
// The database enforces the same rule (question_defs_single_choice_needs_options): a
// SINGLE_CHOICE question with no options is a dead end in the booking flow that nobody
// notices until a customer hits it.
func (kind QuestionKind) RequiresOptions() bool {
	switch kind {
	case QuestionSingleChoice:
		return true
	case QuestionText, QuestionPhoto:
		return false
	}
	return false
}

func (kind QuestionKind) String() string { return string(kind) }

func ParseQuestionKind(raw string) (QuestionKind, error) {
	kind := QuestionKind(raw)
	if !kind.Valid() {
		return "", fmt.Errorf("catalog: unknown question kind %q", raw)
	}
	return kind, nil
}
