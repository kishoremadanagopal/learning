"""cuDNN settings. benchmark=True lets cuDNN time several algorithms and keep the fastest; deterministic=True
asks for repeatable results."""
enabled = True
benchmark = False
deterministic = False
allow_tf32 = True


def is_available():
    return True


def version():
    return 91300
