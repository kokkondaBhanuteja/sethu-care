package catalog_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/kokkondaBhanuteja/sethu-care/internal/catalog"
	"github.com/kokkondaBhanuteja/sethu-care/internal/money"
	"github.com/kokkondaBhanuteja/sethu-care/internal/storage/storagetest"
)

const migrationsDir = "../../db/migrations"

func TestCreateAndReadTheTree(t *testing.T) {
	c, _ := newCatalog(t)
	ctx := context.Background()

	cat, err := c.CreateCategory(ctx, catalog.NewCategory{Name: "AC", Slug: "ac"})
	if err != nil {
		t.Fatalf("CreateCategory: %v", err)
	}
	svc, err := c.CreateService(ctx, catalog.NewService{
		CategoryID: cat.ID, Name: "AC Service", Slug: "ac-service",
		AssignmentMode: catalog.AssignmentAuto, EstimatedMinutes: 60,
	})
	if err != nil {
		t.Fatalf("CreateService: %v", err)
	}
	if _, err := c.CreateVariant(ctx, catalog.NewVariant{ServiceID: svc.ID, Name: "Standard", Price: money.MustFromRupees("599")}); err != nil {
		t.Fatalf("CreateVariant: %v", err)
	}

	// ListServices assembles variants with a single extra query, not N+1.
	services, err := c.ListServices(ctx)
	if err != nil {
		t.Fatalf("ListServices: %v", err)
	}
	if len(services) != 1 || len(services[0].Variants) != 1 {
		t.Fatalf("got %d services with variants %v", len(services), services)
	}
	if got := services[0].Variants[0].Price; got != money.MustFromRupees("599") {
		t.Errorf("variant price = %s, want ₹599", got)
	}
}

func TestCreateServiceUnderMissingCategoryIsNotFound(t *testing.T) {
	c, _ := newCatalog(t)
	_, err := c.CreateService(context.Background(), catalog.NewService{
		CategoryID: uuid.New(), Name: "X", Slug: "x", AssignmentMode: catalog.AssignmentAuto, EstimatedMinutes: 60,
	})
	if !errors.Is(err, catalog.ErrCategoryNotFound) {
		t.Errorf("error = %v, want ErrCategoryNotFound (FK violation mapped to a clean domain error)", err)
	}
}

func TestGetMissingServiceIsNotFound(t *testing.T) {
	c, _ := newCatalog(t)
	if _, err := c.GetService(context.Background(), uuid.New()); !errors.Is(err, catalog.ErrServiceNotFound) {
		t.Errorf("error = %v, want ErrServiceNotFound", err)
	}
}

func newCatalog(t *testing.T) (*catalog.Catalog, *pgxpool.Pool) {
	t.Helper()
	pool := storagetest.NewPool(t, migrationsDir)
	return catalog.New(pool), pool
}
