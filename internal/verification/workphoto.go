package verification

import "fmt"

// WorkPhotoKind is when in the job a photo was taken: BEFORE the work, or AFTER. Together they
// are the visual evidence that the job was done (ROADMAP §8).
type WorkPhotoKind string

const (
	WorkPhotoBefore WorkPhotoKind = "BEFORE"
	WorkPhotoAfter  WorkPhotoKind = "AFTER"
)

func AllWorkPhotoKinds() []WorkPhotoKind {
	return []WorkPhotoKind{WorkPhotoBefore, WorkPhotoAfter}
}

func (kind WorkPhotoKind) Valid() bool {
	switch kind {
	case WorkPhotoBefore, WorkPhotoAfter:
		return true
	}
	return false
}

func (kind WorkPhotoKind) String() string { return string(kind) }

func ParseWorkPhotoKind(raw string) (WorkPhotoKind, error) {
	kind := WorkPhotoKind(raw)
	if !kind.Valid() {
		return "", fmt.Errorf("verification: unknown work photo kind %q", raw)
	}
	return kind, nil
}
