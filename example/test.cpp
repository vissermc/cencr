//
// Copyright (c) 2020 Raith BV. All rights reserved.
/* other comment*/

#include "example/test.h" // ignore this
#include <linux/edd.h>

#include SKIP(ME)

#pragma skip2(me2) /* ignore this
 * too */

int myFunc(int hello, int world) {
    return hello + world + EDD_INFO_LOCKABLE;
}

static int myFunc2(void) {
    return 4;
}