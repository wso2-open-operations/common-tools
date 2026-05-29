// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

package main

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"
)

func TestJobLimiter_TryAcquireCapsAtMax(t *testing.T) {
	l := NewJobLimiter(2)
	if !l.TryAcquire() {
		t.Fatal("first acquire should succeed")
	}
	if !l.TryAcquire() {
		t.Fatal("second acquire should succeed")
	}
	if l.TryAcquire() {
		t.Fatal("third acquire should fail at cap=2")
	}
	l.Release()
	if !l.TryAcquire() {
		t.Fatal("after release, acquire should succeed")
	}
}

func TestJobLimiter_ReleaseIsNonBlockingOnEmpty(t *testing.T) {
	l := NewJobLimiter(1)
	done := make(chan struct{})
	go func() {
		l.Release()
		l.Release()
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Release blocked on empty semaphore — non-blocking guard missing")
	}
}

func TestJobLimiter_ConcurrentAcquireRelease(t *testing.T) {
	const cap = 5
	l := NewJobLimiter(cap)
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if l.TryAcquire() {
				l.Release()
			}
		}()
	}
	wg.Wait()
	for i := 0; i < cap; i++ {
		if !l.TryAcquire() {
			t.Fatalf("acquire %d after concurrent churn should succeed", i)
		}
	}
}

func TestJobLimiter_ZeroOrNegativeMaxBecomesOne(t *testing.T) {
	for _, max := range []int{0, -1} {
		l := NewJobLimiter(max)
		if !l.TryAcquire() {
			t.Fatalf("max=%d should still allow one acquire", max)
		}
		if l.TryAcquire() {
			t.Fatalf("max=%d should cap at 1", max)
		}
	}
}

// IPLimiter must allow up to burst, then refuse until the bucket refills.
func TestIPLimiter_BurstThenRefuse(t *testing.T) {
	l := NewIPLimiter(0.0001, 3, time.Hour, 0)

	for i := 0; i < 3; i++ {
		if !l.Allow("1.2.3.4") {
			t.Fatalf("allow #%d should succeed within burst=3", i+1)
		}
	}
	if l.Allow("1.2.3.4") {
		t.Fatal("4th request from same IP should be refused")
	}
	if !l.Allow("5.6.7.8") {
		t.Fatal("a different IP should have its own bucket")
	}
}

func TestIPLimiter_MiddlewareReturns429(t *testing.T) {
	l := NewIPLimiter(0.0001, 1, time.Hour, 0)

	called := 0
	handler := l.limitByIP(func(w http.ResponseWriter, r *http.Request) {
		called++
		w.WriteHeader(http.StatusOK)
	})

	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodPost, "/", nil)
	r1.RemoteAddr = "1.2.3.4:5000"
	handler(w1, r1)
	if w1.Code != http.StatusOK {
		t.Fatalf("first request code=%d, want 200", w1.Code)
	}

	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodPost, "/", nil)
	r2.RemoteAddr = "1.2.3.4:5001"
	handler(w2, r2)
	if w2.Code != http.StatusTooManyRequests {
		t.Fatalf("second request code=%d, want 429", w2.Code)
	}
	if called != 1 {
		t.Fatalf("inner handler called %d times, want 1", called)
	}
}

func TestIPLimiter_JanitorEvictsIdleVisitors(t *testing.T) {
	l := NewIPLimiter(1, 1, 20*time.Millisecond, 10*time.Millisecond)
	l.Allow("9.9.9.9")
	l.mu.Lock()
	if _, ok := l.visitors["9.9.9.9"]; !ok {
		l.mu.Unlock()
		t.Fatal("visitor missing right after Allow")
	}
	l.mu.Unlock()

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		l.mu.Lock()
		_, present := l.visitors["9.9.9.9"]
		l.mu.Unlock()
		if !present {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("janitor did not evict idle visitor")
}
